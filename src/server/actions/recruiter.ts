"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTextWithGemini } from "@/lib/ai";
import {
  buildCandidateSearchText,
  calculateCandidateConfidence,
  deriveCompanyDomain,
  isWorkEmailVerifiedForDomain,
  parseSalaryExpectation,
  scoreCandidateAgainstJd,
  validateRecruiterSearch,
} from "@/lib/talent-pool";

const recruiterProfileSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  companyLogo: z.string().optional().nullable(),
  websiteUrl: z.string().trim().optional().default(""),
  industry: z.string().trim().optional().default(""),
  companySize: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  about: z.string().trim().optional().default(""),
  workEmail: z.string().email("Valid work email is required").optional().or(z.literal('')),
  title: z.string().trim().optional().default(""),
});

const contactRequestSchema = z.object({
  talentProfileId: z.string().uuid(),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  jobLocation: z.string().trim().optional().default(""),
  salaryRange: z.string().trim().optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
});

export async function getRecruiterProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id },
    include: { company: true }
  });
}

export async function saveRecruiterProfile(data: z.infer<typeof recruiterProfileSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = recruiterProfileSchema.parse(data);
  const verificationDomain = deriveCompanyDomain(parsed.websiteUrl, parsed.workEmail || session.user.email || "");

  // Try to find a company by exact name or website
  let company = null;
  if (parsed.companyName) {
    company = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: parsed.companyName, mode: "insensitive" } },
          { website: { equals: parsed.websiteUrl, mode: "insensitive" } },
        ]
      }
    });

    if (!company) {
      // Create new company
      const slug = parsed.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      company = await prisma.company.create({
        data: {
          name: parsed.companyName,
          slug: `${slug}-${Math.floor(Math.random() * 10000)}`,
          website: parsed.websiteUrl || "",
          logo: parsed.companyLogo,
          industry: parsed.industry,
          size: parsed.companySize,
          country: "Sri Lanka",
          about: parsed.about,
          verificationDomain,
          isVerified: false,
        }
      });
    } else if (verificationDomain && !company.verificationDomain) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { verificationDomain },
      });
    }
  }

  // Automatic verification check (if user email domain matches company verification domain)
  let isVerified = false;
  const emailForVerification = parsed.workEmail || session.user.email || "";
  if (company && company.verificationDomain && isWorkEmailVerifiedForDomain(emailForVerification, company.verificationDomain)) {
    isVerified = true;
  }

  const profile = await prisma.recruiterProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      companyId: company?.id,
      title: parsed.title,
      workEmail: parsed.workEmail || session.user.email || "",
      companyName: parsed.companyName,
      companyLogo: parsed.companyLogo,
      websiteUrl: parsed.websiteUrl,
      industry: parsed.industry,
      companySize: parsed.companySize,
      location: parsed.location,
      about: parsed.about,
      isVerified: isVerified,
    },
    update: {
      companyId: company?.id,
      title: parsed.title,
      workEmail: parsed.workEmail,
      companyName: parsed.companyName,
      companyLogo: parsed.companyLogo,
      websiteUrl: parsed.websiteUrl,
      industry: parsed.industry,
      companySize: parsed.companySize,
      location: parsed.location,
      about: parsed.about,
      isVerified: isVerified ? true : undefined, // Don't unverify if already verified
    }
  });

  revalidatePath("/talent-pool");
  revalidatePath("/talent-pool/company");
  return profile;
}

// Advanced Boolean and Filter Search
export async function searchTalentPool(filters: {
  query?: string; // Natural or Boolean text search
  title?: string;
  skill?: string;
  location?: string;
  careerLevel?: string;
  industry?: string;
  isOpenToWork?: boolean;
  minExperience?: number;
  verifiedOnly?: boolean;
  district?: string;
  university?: string;
  currency?: string;
  noticePeriod?: string;
  salaryMax?: number;
  language?: string;
  openTo?: string;
  remote?: boolean;
  company?: string;
  certification?: string;
  sort?: string;
  jdText?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Fetch recruiter to check blocklists
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  validateRecruiterSearch([filters.query, filters.title, filters.skill, filters.company, filters.university, filters.certification].filter(Boolean).join(" "));

  const where: any = {
    visibility: { in: ["public", "recruiters_only", "anonymous"] },
    completionScore: { gte: 80 },
  };

  // Blocklist check
  if (recruiter?.companyId) {
    where.candidateBlocks = {
      none: { companyId: recruiter.companyId }
    };
  }

  if (filters.isOpenToWork !== undefined) {
    where.isOpenToWork = filters.isOpenToWork;
  }

  if (filters.verifiedOnly) {
    where.isVerified = true;
  }

  if (filters.careerLevel) {
    where.careerLevel = filters.careerLevel;
  }

  if (filters.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }

  if (filters.district) {
    where.city = { contains: filters.district, mode: "insensitive" };
  } else if (filters.location) {
    where.OR = [
      { city: { contains: filters.location, mode: "insensitive" } },
      { country: { contains: filters.location, mode: "insensitive" } },
      { targetLocation: { contains: filters.location, mode: "insensitive" } },
    ];
  }

  if (filters.university) {
    where.educations = {
      some: { institutionName: { contains: filters.university, mode: "insensitive" } }
    };
  }

  if (filters.noticePeriod) {
    where.noticePeriod = { contains: filters.noticePeriod, mode: "insensitive" };
  }

  if (filters.company) {
    where.experiences = {
      some: { companyName: { contains: filters.company, mode: "insensitive" } }
    };
  }

  if (filters.certification) {
    where.certifications = {
      some: { name: { contains: filters.certification, mode: "insensitive" } }
    };
  }

  if (filters.skill) {
    where.skills = {
      some: { name: { contains: filters.skill, mode: "insensitive" } }
    };
  }

  // Handle boolean/text query in headline, bio, or experience descriptions
  if (filters.query || filters.title) {
    const term = (filters.query || filters.title || "").toLowerCase();
    
    // Very basic parsing for OR / AND logic
    if (term.includes(" or ") || term.includes(" and ")) {
      // In a real system, we would map to PostgreSQL FTS (to_tsquery).
      const keywords = term.split(/\s+(?:or|and)\s+/i).map(s => s.replace(/[^a-z0-9\s]/gi, '').trim()).filter(Boolean);
      
      if (term.includes(" and ")) {
        where.AND = keywords.map(kw => ({
          OR: [
            { headline: { contains: kw, mode: "insensitive" } },
            { bio: { contains: kw, mode: "insensitive" } },
            { skills: { some: { name: { contains: kw, mode: "insensitive" } } } },
            { experiences: { some: { title: { contains: kw, mode: "insensitive" } } } },
            { experiences: { some: { description: { contains: kw, mode: "insensitive" } } } }
          ]
        }));
      } else {
        where.OR = keywords.map(kw => ({
          OR: [
            { headline: { contains: kw, mode: "insensitive" } },
            { bio: { contains: kw, mode: "insensitive" } },
            { skills: { some: { name: { contains: kw, mode: "insensitive" } } } },
            { experiences: { some: { title: { contains: kw, mode: "insensitive" } } } },
            { experiences: { some: { description: { contains: kw, mode: "insensitive" } } } }
          ]
        }));
      }
    } else {
      where.AND = [
        {
          OR: [
            { headline: { contains: term, mode: "insensitive" } },
            { bio: { contains: term, mode: "insensitive" } },
            { experiences: { some: { title: { contains: term, mode: "insensitive" } } } },
            { experiences: { some: { description: { contains: term, mode: "insensitive" } } } }
          ]
        }
      ];
    }
  }

  const results = await prisma.talentProfile.findMany({
    where,
    include: {
      skills: { take: 5, orderBy: { sortOrder: "asc" } },
      experiences: { take: 1, orderBy: { startDate: "desc" } },
      educations: { take: 1, orderBy: { startDate: "desc" } },
      certifications: { take: 3 },
      user: {
        select: {
          firstName: true,
          lastName: true,
          image: true,
        }
      }
    },
    orderBy: filters.sort === "freshest" ? { updatedAt: "desc" } : { completionScore: "desc" },
    take: 50, // Limit to top 50 for performance
  });

  let enriched = results.map((profile) => {
    const searchText = buildCandidateSearchText(profile);
    const jd = filters.jdText ? scoreCandidateAgainstJd(searchText, filters.jdText) : null;
    return {
      ...profile,
      candidateConfidence: calculateCandidateConfidence(profile),
      aiMatchScore: jd?.score ?? null,
      matchReasons: jd?.matched.slice(0, 5) ?? [],
      matchGaps: jd?.missing.slice(0, 5) ?? [],
    };
  });

  if (filters.salaryMax) {
    enriched = enriched.filter((profile) => {
      const expected = parseSalaryExpectation(profile.expectedSalary);
      return !expected || expected <= filters.salaryMax!;
    });
  }

  if (filters.openTo) {
    enriched = enriched.filter((profile) => {
      const preferred = Array.isArray(profile.preferredJobTypes) ? profile.preferredJobTypes.map(String) : [];
      return preferred.some((item) => item.toLowerCase().includes(filters.openTo!.toLowerCase()));
    });
  }

  if (filters.language) {
    enriched = enriched.filter((profile) => {
      const languages = Array.isArray(profile.languages) ? profile.languages : [];
      return JSON.stringify(languages).toLowerCase().includes(filters.language!.toLowerCase());
    });
  }

  if (filters.remote) {
    enriched = enriched.filter((profile) => /remote|hybrid|anywhere/i.test(`${profile.targetLocation} ${profile.city} ${profile.country}`));
  }

  if (filters.jdText) {
    enriched.sort((left, right) => (right.aiMatchScore ?? 0) - (left.aiMatchScore ?? 0));
  } else if (filters.sort === "confidence") {
    enriched.sort((left, right) => right.candidateConfidence - left.candidateConfidence);
  }

  return enriched;
}

// Project/Pipeline Management
export async function getProjects() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.recruiterProject.findMany({
    where: { recruiterId: session.user.id },
    include: {
      _count: { select: { candidates: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function createProject(name: string, description: string = "") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await prisma.recruiterProject.create({
    data: {
      recruiterId: session.user.id,
      name,
      description
    }
  });
  
  revalidatePath("/talent-pool/projects");
  return project;
}

export async function addCandidateToProject(projectId: string, talentProfileId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership
  const project = await prisma.recruiterProject.findUnique({
    where: { id: projectId }
  });
  if (project?.recruiterId !== session.user.id) throw new Error("Unauthorized");

  const candidate = await prisma.projectCandidate.create({
    data: {
      projectId,
      talentProfileId,
      stage: "new"
    }
  });

  revalidatePath(`/talent-pool/projects/${projectId}`);
  return candidate;
}

export async function updateCandidateStage(id: string, stage: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const candidate = await prisma.projectCandidate.update({
    where: { id },
    data: { stage }
  });

  revalidatePath(`/talent-pool/projects/${candidate.projectId}`);
  return candidate;
}

export async function bulkUpdateCandidateStages(ids: string[], stage: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const candidates = await prisma.projectCandidate.findMany({
    where: { id: { in: ids } }
  });

  if (candidates.length === 0) return { count: 0 };

  const result = await prisma.projectCandidate.updateMany({
    where: { id: { in: ids } },
    data: { stage }
  });

  // Revalidate the first candidate's project (assuming they all belong to the same project)
  revalidatePath(`/talent-pool/projects/${candidates[0].projectId}`);
  
  return { count: result.count };
}

export async function exportPipelineToCSV(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await prisma.recruiterProject.findUnique({
    where: { id: projectId, recruiterId: session.user.id },
    include: {
      candidates: {
        include: {
          talentProfile: {
            include: {
              user: true,
              experiences: { take: 1, orderBy: { startDate: "desc" } }
            }
          }
        }
      }
    }
  });

  if (!project) throw new Error("Project not found.");

  // Build CSV string
  const headers = ["Candidate ID", "First Name", "Last Name", "Email", "Headline", "Current Role", "Current Company", "Location", "Pipeline Stage"];
  const rows = project.candidates.map(c => {
    const p = c.talentProfile;
    const u = p.user;
    const exp = p.experiences[0];
    return [
      c.id,
      u.firstName,
      u.lastName,
      p.isEmailPublic ? u.email : "Hidden",
      p.headline || "",
      exp?.title || "",
      exp?.companyName || "",
      p.city ? `${p.city}, ${p.country}` : p.country,
      c.stage
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// Request Contact details
export async function sendContactRequest(data: z.infer<typeof contactRequestSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = contactRequestSchema.parse(data);

  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!recruiter) {
    throw new Error("You must set up a Recruiter Profile first.");
  }

  if (!recruiter.isVerified) {
    throw new Error("Company verification is required before sending outreach.");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.talentContactRequest.count({
    where: {
      recruiterId: session.user.id,
      createdAt: { gte: startOfDay },
    },
  });
  if (sentToday >= 50) {
    throw new Error("Daily outreach limit reached. Try again tomorrow.");
  }

  if (recruiter.companyId) {
    const blocked = await prisma.candidateBlock.findUnique({
      where: {
        talentProfileId_companyId: {
          talentProfileId: parsed.talentProfileId,
          companyId: recruiter.companyId,
        },
      },
    });
    if (blocked) {
      throw new Error("This candidate has blocked outreach from your company.");
    }
  }

  // Deduct contact credit
  if (recruiter.contactCredits <= 0) {
    throw new Error("Insufficient contact credits. Please upgrade your plan.");
  }

  await prisma.recruiterProfile.update({
    where: { id: recruiter.id },
    data: { contactCredits: { decrement: 1 } }
  });

  // Create contact request
  const request = await prisma.talentContactRequest.create({
    data: {
      recruiterId: session.user.id,
      talentProfileId: parsed.talentProfileId,
      jobTitle: parsed.jobTitle,
      companyName: parsed.companyName,
      jobLocation: parsed.jobLocation,
      salaryRange: parsed.salaryRange,
      message: parsed.message,
      status: "pending",
    }
  });

  // Track search appearance/interest views
  await prisma.talentProfileView.create({
    data: {
      talentProfileId: parsed.talentProfileId,
      viewerId: session.user.id,
      viewerName: session.user.name || "A Recruiter",
      viewerCompany: recruiter.companyName,
    }
  });

  await prisma.talentProfile.update({
    where: { id: parsed.talentProfileId },
    data: { views: { increment: 1 } }
  });

  return request;
}

// Toggle shortlisting a candidate
export async function toggleShortlist(talentProfileId: string, folder: string = "General") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await prisma.talentShortlist.findUnique({
    where: {
      recruiterId_talentProfileId: {
        recruiterId: session.user.id,
        talentProfileId,
      }
    }
  });

  if (existing) {
    await prisma.talentShortlist.delete({
      where: { id: existing.id }
    });
    return { shortlisted: false };
  } else {
    await prisma.talentShortlist.create({
      data: {
        recruiterId: session.user.id,
        talentProfileId,
        folder,
      }
    });
    return { shortlisted: true };
  }
}

// Fetch Shortlisted candidates
export async function getShortlistedTalent() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.talentShortlist.findMany({
    where: { recruiterId: session.user.id },
    include: {
      talentProfile: {
        include: {
          skills: { take: 5 },
          experiences: { take: 1, orderBy: { startDate: "desc" } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              image: true,
            }
          }
        }
      }
    }
  });
}

export async function generateOutreachDraftAction(input: {
  talentProfileId: string;
  jobTitle: string;
  companyName: string;
  jobLocation: string;
  salaryRange: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!recruiter) {
    throw new Error("You must set up a Recruiter Profile first.");
  }

  const profile = await prisma.talentProfile.findUnique({
    where: { id: input.talentProfileId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      experiences: { take: 3, orderBy: { startDate: "desc" } },
      skills: { take: 10, orderBy: { sortOrder: "asc" } }
    }
  });

  if (!profile) {
    throw new Error("Talent profile not found.");
  }

  const name = profile.user.firstName;
  const recentRole = profile.experiences[0]?.title || profile.headline;
  const skillsList = profile.skills.map(s => s.name).join(", ");

  const prompt = `You are ${session.user.name || "a Recruiter"} from ${input.companyName}, writing a highly personalized InMail-style outreach message to ${name}.
  
Candidate Context:
- Current Role: ${recentRole}
- Skills: ${skillsList}
- Bio: ${profile.bio || "N/A"}

Role Context:
- Title: ${input.jobTitle}
- Location: ${input.jobLocation || "N/A"}
- Salary: ${input.salaryRange || "N/A"}

Instructions:
Write a brief, professional, and personalized 3-paragraph message (max 150 words) inviting them to discuss the opportunity. Reference a specific skill or their recent role. Do not use placeholders like [Your Name]. Sign off with my name (${session.user.name || "The Recruiter"}). Do not include a subject line.
`;

  return generateTextWithGemini(prompt);
}

export async function saveSearchAction(name: string, query: string, searchParamsString: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!recruiter) {
    throw new Error("You must set up a Recruiter Profile first.");
  }

  const savedSearch = await prisma.savedSearch.create({
    data: {
      recruiterId: recruiter.id,
      name,
      query,
      filtersJson: searchParamsString,
      alertFrequency: "daily",
    }
  });

  revalidatePath("/talent-pool");
  return savedSearch;
}
