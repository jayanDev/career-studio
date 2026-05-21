"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
          isVerified: false,
        }
      });
    }
  }

  // Automatic verification check (if user email domain matches company verification domain)
  let isVerified = false;
  if (company && company.verificationDomain && session.user.email?.endsWith(`@${company.verificationDomain}`)) {
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
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Fetch recruiter to check blocklists
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    visibility: { in: ["public", "recruiters_only"] },
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
      user: {
        select: {
          firstName: true,
          lastName: true,
          image: true,
        }
      }
    },
    orderBy: {
      completionScore: "desc",
    },
    take: 50, // Limit to top 50 for performance
  });

  return results;
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
