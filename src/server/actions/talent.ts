"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Schema validations
const baseProfileSchema = z.object({
  headline: z.string().trim().max(200),
  bio: z.string().trim().max(2000),
  city: z.string().trim().max(100),
  country: z.string().trim().max(100),
  targetLocation: z.string().trim().max(100).optional().default(""),
  isOpenToWork: z.boolean().default(true),
  preferredJobTypes: z.array(z.string()).default([]),
  industry: z.string().trim().max(150),
  careerLevel: z.string().trim().max(50),
  expectedSalary: z.string().trim().max(100).optional().default(""),
  isExpectedSalaryPublic: z.boolean().default(false),
  noticePeriod: z.string().trim().max(100).optional().default(""),
  nationality: z.string().trim().max(100).optional().default(""),
  visaStatus: z.string().trim().max(100).optional().default(""),
  availabilityDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  languages: z.array(z.object({
    name: z.string(),
    level: z.string(),
  })).default([]),
});

const experienceSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Job title is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  location: z.string().trim().optional().default(""),
  employmentType: z.string().default("full_time"),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().optional().default(""),
  skillsUsed: z.array(z.string()).default([]),
});

const educationSchema = z.object({
  id: z.string().uuid().optional(),
  institutionName: z.string().trim().min(1, "Institution name is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  fieldOfStudy: z.string().trim().optional().default(""),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  isOngoing: z.boolean().default(false),
  gpa: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});

const skillSchema = z.object({
  name: z.string().trim().min(1, "Skill name is required"),
  category: z.string().default("Technical"),
  proficiency: z.string().default("Intermediate"),
  yearsExperience: z.number().optional().nullable(),
});

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Project title is required"),
  projectType: z.string().default("Personal"),
  description: z.string().trim().optional().default(""),
  role: z.string().trim().optional().default(""),
  tools: z.array(z.string()).default([]),
  outcome: z.string().trim().optional().default(""),
  projectUrl: z.string().trim().optional().default(""),
  githubUrl: z.string().trim().optional().default(""),
  demoVideoUrl: z.string().trim().optional().default(""),
  imageUrl: z.string().optional().nullable(),
});

const certificationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Certification name is required"),
  issuingOrg: z.string().trim().min(1, "Issuing organization is required"),
  issueDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  expiryDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  credentialId: z.string().trim().optional().default(""),
  credentialUrl: z.string().trim().optional().default(""),
});

const awardSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Award title is required"),
  issuer: z.string().trim().min(1, "Issuer is required"),
  dateReceived: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  description: z.string().trim().optional().default(""),
});

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Service name is required"),
  description: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default(""),
  pricing: z.string().trim().optional().default(""),
  deliveryTime: z.string().trim().optional().default(""),
  imageUrl: z.string().optional().nullable(),
});

const portfolioSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required"),
  imageUrl: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  externalUrl: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});

const privacySchema = z.object({
  customSlug: z.string().trim().min(3).max(50).regex(/^[a-z0-9-]+$/, "Only lowercase alphanumeric characters and hyphens allowed").nullable().optional(),
  isPhonePublic: z.boolean(),
  isEmailPublic: z.boolean(),
  visibility: z.enum(["public", "recruiters_only", "private"]),
});

// Helper to get or create talent profile for current user
export async function getOrCreateTalentProfile(userId: string) {
  let profile = await prisma.talentProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        }
      },
      experiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: { startDate: "desc" } },
      skills: { orderBy: { sortOrder: "asc" } },
      projects: { orderBy: { sortOrder: "asc" } },
      services: true,
      portfolios: true,
      certifications: true,
      awards: true,
    }
  });

  if (!profile) {
    // Generate default slug based on user email or random
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let defaultSlug = user?.username || user?.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") || `user-${userId.slice(0, 8)}`;
    
    // Check if slug is unique, append random digits if not
    const slugExists = await prisma.talentProfile.findUnique({ where: { customSlug: defaultSlug } });
    if (slugExists) {
      defaultSlug = `${defaultSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    profile = await prisma.talentProfile.create({
      data: {
        userId,
        customSlug: defaultSlug,
        headline: user ? `${user.firstName} ${user.lastName}` : "",
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          }
        },
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        services: true,
        portfolios: true,
        certifications: true,
        awards: true,
      }
    });
  }

  return profile;
}

// Recalculates candidate profile strength score
export async function updateProfileCompletionScore(talentProfileId: string) {
  const profile = await prisma.talentProfile.findUnique({
    where: { id: talentProfileId },
    include: {
      experiences: true,
      educations: true,
      skills: true,
      projects: true,
    }
  });

  if (!profile) return 0;

  let baseScore = 0;
  if (profile.profileImage) baseScore += 10;
  if (profile.headline) baseScore += 10;
  if (profile.bio) baseScore += 10;
  if (profile.city && profile.country) baseScore += 10;
  if (profile.experiences.length > 0) baseScore += 15;
  if (profile.educations.length > 0) baseScore += 15;
  if (profile.skills.length >= 3) baseScore += 10;
  if (profile.projects.length > 0) baseScore += 10;
  if (profile.cvPath) baseScore += 10;

  // Maximum base score is 100. Let's add an ATS boost if they have run any ATS checks.
  // We query all ATS check results belonging to this user's resumes
  const atsResults = await prisma.aTSCheckResult.findMany({
    where: {
      version: {
        resume: {
          userId: profile.userId
        }
      }
    },
    select: { overallScore: true },
    orderBy: { overallScore: 'desc' },
    take: 1
  });

  let atsBoost = 0;
  if (atsResults.length > 0 && atsResults[0].overallScore > 0) {
    // Up to 15 bonus points based on their ATS readiness.
    atsBoost = Math.round((atsResults[0].overallScore / 100) * 15);
  }

  // Recency multiplier
  // Updated < 30 days = 1.0
  // Updated < 90 days = 0.9
  // Updated < 180 days = 0.8
  // Older than 180 days = 0.7
  const msSinceUpdate = Date.now() - profile.updatedAt.getTime();
  const daysSinceUpdate = msSinceUpdate / (1000 * 60 * 60 * 24);
  let recencyMultiplier = 1.0;
  if (daysSinceUpdate > 180) recencyMultiplier = 0.7;
  else if (daysSinceUpdate > 90) recencyMultiplier = 0.8;
  else if (daysSinceUpdate > 30) recencyMultiplier = 0.9;

  let finalScore = Math.min(100, Math.round((baseScore + atsBoost) * recencyMultiplier));

  await prisma.talentProfile.update({
    where: { id: talentProfileId },
    data: { completionScore: finalScore }
  });

  return finalScore;
}

export async function updateTalentBaseInfo(data: z.infer<typeof baseProfileSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = baseProfileSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentProfile.update({
    where: { id: profile.id },
    data: {
      headline: parsed.headline,
      bio: parsed.bio,
      city: parsed.city,
      country: parsed.country,
      targetLocation: parsed.targetLocation,
      isOpenToWork: parsed.isOpenToWork,
      preferredJobTypes: parsed.preferredJobTypes,
      industry: parsed.industry,
      careerLevel: parsed.careerLevel,
      expectedSalary: parsed.expectedSalary,
      isExpectedSalaryPublic: parsed.isExpectedSalaryPublic,
      noticePeriod: parsed.noticePeriod,
      nationality: parsed.nationality,
      visaStatus: parsed.visaStatus,
      availabilityDate: parsed.availabilityDate,
      languages: parsed.languages,
    }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function updateTalentProfileImages(coverImage: string | null, profileImage: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const profile = await getOrCreateTalentProfile(session.user.id);
  const data: Record<string, string | null> = {};
  if (coverImage !== undefined) data.coverImage = coverImage;
  if (profileImage !== undefined) data.profileImage = profileImage;

  await prisma.talentProfile.update({
    where: { id: profile.id },
    data,
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function updateTalentPrivacy(data: z.infer<typeof privacySchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = privacySchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  // Check unique slug
  if (parsed.customSlug && parsed.customSlug !== profile.customSlug) {
    const exists = await prisma.talentProfile.findUnique({
      where: { customSlug: parsed.customSlug }
    });
    if (exists) {
      throw new Error("Profile URL is already taken.");
    }
  }

  await prisma.talentProfile.update({
    where: { id: profile.id },
    data: {
      customSlug: parsed.customSlug || null,
      isPhonePublic: parsed.isPhonePublic,
      isEmailPublic: parsed.isEmailPublic,
      visibility: parsed.visibility,
    }
  });

  revalidatePath("/talent");
}

// Experience Actions
export async function saveExperience(data: z.infer<typeof experienceSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = experienceSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentExperience.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        title: parsed.title,
        companyName: parsed.companyName,
        location: parsed.location,
        employmentType: parsed.employmentType,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isCurrent: parsed.isCurrent,
        description: parsed.description,
        skillsUsed: parsed.skillsUsed,
      }
    });
  } else {
    await prisma.talentExperience.create({
      data: {
        talentProfileId: profile.id,
        title: parsed.title,
        companyName: parsed.companyName,
        location: parsed.location,
        employmentType: parsed.employmentType,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isCurrent: parsed.isCurrent,
        description: parsed.description,
        skillsUsed: parsed.skillsUsed,
      }
    });
  }

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function deleteExperience(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentExperience.delete({
    where: { id, talentProfileId: profile.id }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

// Education Actions
export async function saveEducation(data: z.infer<typeof educationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = educationSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentEducation.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        institutionName: parsed.institutionName,
        degree: parsed.degree,
        fieldOfStudy: parsed.fieldOfStudy,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isOngoing: parsed.isOngoing,
        gpa: parsed.gpa,
        description: parsed.description,
      }
    });
  } else {
    await prisma.talentEducation.create({
      data: {
        talentProfileId: profile.id,
        institutionName: parsed.institutionName,
        degree: parsed.degree,
        fieldOfStudy: parsed.fieldOfStudy,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        isOngoing: parsed.isOngoing,
        gpa: parsed.gpa,
        description: parsed.description,
      }
    });
  }

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function deleteEducation(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentEducation.delete({
    where: { id, talentProfileId: profile.id }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

// Skill Actions
export async function addSkill(data: z.infer<typeof skillSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = skillSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentSkill.upsert({
    where: {
      talentProfileId_name: {
        talentProfileId: profile.id,
        name: parsed.name
      }
    },
    create: {
      talentProfileId: profile.id,
      name: parsed.name,
      category: parsed.category,
      proficiency: parsed.proficiency,
      yearsExperience: parsed.yearsExperience,
    },
    update: {
      category: parsed.category,
      proficiency: parsed.proficiency,
      yearsExperience: parsed.yearsExperience,
    }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function deleteSkill(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentSkill.delete({
    where: {
      talentProfileId_name: {
        talentProfileId: profile.id,
        name
      }
    }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function toggleTopSkill(name: string, isTop: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentSkill.update({
    where: {
      talentProfileId_name: {
        talentProfileId: profile.id,
        name
      }
    },
    data: { isTop }
  });

  revalidatePath("/talent");
}

// Project Actions
export async function saveProject(data: z.infer<typeof projectSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = projectSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentProject.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        title: parsed.title,
        projectType: parsed.projectType,
        description: parsed.description,
        role: parsed.role,
        tools: parsed.tools,
        outcome: parsed.outcome,
        projectUrl: parsed.projectUrl,
        githubUrl: parsed.githubUrl,
        demoVideoUrl: parsed.demoVideoUrl,
        imageUrl: parsed.imageUrl,
      }
    });
  } else {
    await prisma.talentProject.create({
      data: {
        talentProfileId: profile.id,
        title: parsed.title,
        projectType: parsed.projectType,
        description: parsed.description,
        role: parsed.role,
        tools: parsed.tools,
        outcome: parsed.outcome,
        projectUrl: parsed.projectUrl,
        githubUrl: parsed.githubUrl,
        demoVideoUrl: parsed.demoVideoUrl,
        imageUrl: parsed.imageUrl,
      }
    });
  }

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentProject.delete({
    where: { id, talentProfileId: profile.id }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

// Service Actions
export async function saveService(data: z.infer<typeof serviceSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = serviceSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentService.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        pricing: parsed.pricing,
        deliveryTime: parsed.deliveryTime,
        imageUrl: parsed.imageUrl,
      }
    });
  } else {
    await prisma.talentService.create({
      data: {
        talentProfileId: profile.id,
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        pricing: parsed.pricing,
        deliveryTime: parsed.deliveryTime,
        imageUrl: parsed.imageUrl,
      }
    });
  }

  revalidatePath("/talent");
}

export async function deleteService(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentService.delete({
    where: { id, talentProfileId: profile.id }
  });

  revalidatePath("/talent");
}

// Portfolio Actions
export async function savePortfolio(data: z.infer<typeof portfolioSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = portfolioSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentPortfolio.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        title: parsed.title,
        imageUrl: parsed.imageUrl,
        fileUrl: parsed.fileUrl,
        externalUrl: parsed.externalUrl,
        category: parsed.category,
        description: parsed.description,
      }
    });
  } else {
    await prisma.talentPortfolio.create({
      data: {
        talentProfileId: profile.id,
        title: parsed.title,
        imageUrl: parsed.imageUrl,
        fileUrl: parsed.fileUrl,
        externalUrl: parsed.externalUrl,
        category: parsed.category,
        description: parsed.description,
      }
    });
  }

  revalidatePath("/talent");
}

export async function deletePortfolio(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentPortfolio.delete({
    where: { id, talentProfileId: profile.id }
  });

  revalidatePath("/talent");
}

// Certification Actions
export async function saveCertification(data: z.infer<typeof certificationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = certificationSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentCertification.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        name: parsed.name,
        issuingOrg: parsed.issuingOrg,
        issueDate: parsed.issueDate,
        expiryDate: parsed.expiryDate,
        credentialId: parsed.credentialId,
        credentialUrl: parsed.credentialUrl,
      }
    });
  } else {
    await prisma.talentCertification.create({
      data: {
        talentProfileId: profile.id,
        name: parsed.name,
        issuingOrg: parsed.issuingOrg,
        issueDate: parsed.issueDate,
        expiryDate: parsed.expiryDate,
        credentialId: parsed.credentialId,
        credentialUrl: parsed.credentialUrl,
        verificationStatus: "pending",
      }
    });
  }

  revalidatePath("/talent");
}

export async function deleteCertification(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentCertification.delete({
    where: { id, talentProfileId: profile.id }
  });

  revalidatePath("/talent");
}

// Award Actions
export async function saveAward(data: z.infer<typeof awardSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = awardSchema.parse(data);
  const profile = await getOrCreateTalentProfile(session.user.id);

  if (parsed.id) {
    await prisma.talentAward.update({
      where: { id: parsed.id, talentProfileId: profile.id },
      data: {
        title: parsed.title,
        issuer: parsed.issuer,
        dateReceived: parsed.dateReceived,
        description: parsed.description,
      }
    });
  } else {
    await prisma.talentAward.create({
      data: {
        talentProfileId: profile.id,
        title: parsed.title,
        issuer: parsed.issuer,
        dateReceived: parsed.dateReceived,
        description: parsed.description,
      }
    });
  }

  revalidatePath("/talent");
}

export async function deleteAward(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentAward.delete({
    where: { id, talentProfileId: profile.id }
  });

  revalidatePath("/talent");
}

// CV PDF Link save
export async function saveCVPath(cvPath: string | null, cvFilename: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const profile = await getOrCreateTalentProfile(session.user.id);

  await prisma.talentProfile.update({
    where: { id: profile.id },
    data: {
      cvPath,
      cvFilename,
    }
  });

  await updateProfileCompletionScore(profile.id);
  revalidatePath("/talent");
}

// Respond to Recruiter Request
export async function respondToContactRequest(requestId: string, status: "accepted" | "declined") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const profile = await getOrCreateTalentProfile(session.user.id);

  const request = await prisma.talentContactRequest.findUnique({
    where: { id: requestId, talentProfileId: profile.id }
  });

  if (!request) throw new Error("Contact request not found");

  await prisma.talentContactRequest.update({
    where: { id: requestId },
    data: { status }
  });

  // If accepted, add a Connection and start a Conversation automatically!
  if (status === "accepted") {
    // Check if Connection already exists
    const userA = session.user.id;
    const userB = request.recruiterId;
    const sortedUserIds = [userA, userB].sort();
    
    await prisma.connection.upsert({
      where: {
        userAId_userBId: {
          userAId: sortedUserIds[0],
          userBId: sortedUserIds[1]
        }
      },
      create: {
        userAId: sortedUserIds[0],
        userBId: sortedUserIds[1]
      },
      update: {}
    });

    // Create a conversation for in-app messaging
    const conv = await prisma.conversation.create({
      data: {
        title: `${profile.user?.firstName || "Candidate"} & Recruiter`,
      }
    });

    // Send a system welcome message
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: request.recruiterId,
        body: `Connection accepted! Contact Request: "${request.message}"\nJob: ${request.jobTitle} at ${request.companyName}`,
      }
    });
  }

  revalidatePath("/talent");
}
