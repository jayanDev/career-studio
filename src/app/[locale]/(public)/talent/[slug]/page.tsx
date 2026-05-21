import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PublicProfileClient } from "@/components/talent/public/PublicProfileClient";

type PublicProfilePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await prisma.talentProfile.findUnique({
    where: { customSlug: slug },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        }
      }
    }
  });

  if (!profile) {
    return {
      title: "Profile Not Found - Career Studio",
    };
  }

  const name = `${profile.user.firstName} ${profile.user.lastName}`;
  return {
    title: `${name} - Public Career Profile | Career Studio`,
    description: profile.headline || `View ${name}'s certified professional career profile, key projects, and expertise.`,
    openGraph: {
      title: `${name} | Career Studio Profile`,
      description: profile.headline || `View ${name}'s portfolio and certifications.`,
      images: profile.profileImage ? [{ url: profile.profileImage }] : [],
    }
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  // Find candidate profile
  const profile = await prisma.talentProfile.findUnique({
    where: { customSlug: slug },
    include: {
      experiences: { orderBy: { startDate: "desc" } },
      educations: { orderBy: { startDate: "desc" } },
      skills: { orderBy: { sortOrder: "asc" } },
      projects: { orderBy: { sortOrder: "asc" } },
      services: true,
      portfolios: true,
      certifications: true,
      awards: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          image: true,
          email: true,
        }
      }
    }
  });

  if (!profile) {
    notFound();
  }

  const isOwner = session?.user?.id === profile.userId;

  // Enforce visibility controls
  if (profile.visibility === "private" && !isOwner) {
    notFound();
  }

  // Load recruiter profile if logged in
  let recruiterProfile = null;
  let isShortlisted = false;
  let contactRequestStatus: "pending" | "accepted" | "declined" | "none" = "none";

  if (session?.user?.id) {
    recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (recruiterProfile) {
      // Check shortlist
      const shortlist = await prisma.talentShortlist.findUnique({
        where: {
          recruiterId_talentProfileId: {
            recruiterId: session.user.id,
            talentProfileId: profile.id
          }
        }
      });
      isShortlisted = !!shortlist;
    }

    // Check contact requests
    const contactReq = await prisma.talentContactRequest.findFirst({
      where: {
        recruiterId: session.user.id,
        talentProfileId: profile.id
      },
      orderBy: { createdAt: "desc" }
    });

    if (contactReq) {
      contactRequestStatus = contactReq.status as any;
    }

    // Log profile view analytics if viewer is not the profile owner
    if (!isOwner) {
      await prisma.talentProfile.update({
        where: { id: profile.id },
        data: { views: { increment: 1 } }
      });

      await prisma.talentProfileView.create({
        data: {
          talentProfileId: profile.id,
          viewerId: session.user.id,
          viewerName: session.user.name || "Anonymous Recruiter",
          viewerCompany: recruiterProfile?.companyName || "Hiring Company",
        }
      });
    }
  } else {
    // Guest view log
    await prisma.talentProfile.update({
      where: { id: profile.id },
      data: { views: { increment: 1 } }
    });

    await prisma.talentProfileView.create({
      data: {
        talentProfileId: profile.id,
        viewerId: null,
        viewerName: "Anonymous Guest",
        viewerCompany: "",
      }
    });
  }

  // Anonymize sensitive candidate data for unconnected viewers
  const isConnected = contactRequestStatus === "accepted" || isOwner;
  const isAnonymousView = !isConnected;

  if (isAnonymousView) {
    // Scrub last name to initial
    if (profile.user.lastName) {
      profile.user.lastName = profile.user.lastName.charAt(0) + ".";
    }
    // Scrub contact details and CV
    profile.user.email = "";
    profile.isEmailPublic = false;
    profile.isPhonePublic = false;
    profile.cvPath = null;
    profile.cvFilename = null;
  }

  return (
    <div className="py-6">
      <PublicProfileClient
        profile={profile as any}
        recruiterProfile={recruiterProfile}
        initialShortlisted={isShortlisted}
        contactRequestStatus={contactRequestStatus}
        isOwner={isOwner}
        locale={locale}
        isAnonymousView={isAnonymousView}
      />
    </div>
  );
}
