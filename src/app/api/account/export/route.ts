import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GDPR right-of-access export (Article 15).
 *
 * Streams every record we hold for the requesting user as a single JSON
 * file the user can download. Sibling to the right-to-erasure deletion
 * action — together they cover the two main consumer GDPR requirements.
 *
 * Scope: everything the user created or that's directly tied to their
 * identity. Aggregate / anonymised analytics (e.g. ShareView with
 * ownerId already nulled) are NOT included.
 *
 * Note: blob storage for uploaded files (resume CVs, profile photos,
 * cover images) lives on a cloud bucket; we include the metadata + URL
 * here but the binary download itself is out of scope for this JSON.
 * That's documented in the exported `_notes` block.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle — exporting is expensive (50+ joins).
  const limited = await enforceRateLimit("ai", request, session.user.id);
  if (limited) return limited;

  const userId = session.user.id;

  // Run every read in parallel. Each is a single Prisma call that joins
  // the user's own records — no other tenant's data is reachable.
  const [
    user,
    profile,
    resumes,
    gcvResumes,
    coverLetters,
    cvDocuments,
    linkedInAudits,
    careerGpsSessions,
    jobApplications,
    practiceSessions,
    savedQuestions,
    salarySubmissions,
    talentProfile,
    recruiterProfile,
    subscriptions,
    payments,
    notifications,
    feedback,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.resume.findMany({ where: { userId }, include: { content: true } }),
    prisma.gCVResume.findMany({ where: { userId } }),
    prisma.coverLetter.findMany({ where: { userId } }),
    prisma.cVDocument.findMany({ where: { userId } }),
    prisma.linkedInAudit.findMany({ where: { userId } }),
    // CareerGPS related rows aren't declared as Prisma relations on the
    // session model, so we fetch sessions first and join nested rows
    // afterwards (see below).
    prisma.careerGPSSession.findMany({ where: { userId } }),
    prisma.jobApplication.findMany({ where: { userId } }),
    prisma.practiceSession.findMany({ where: { userId } }),
    prisma.savedQuestion.findMany({ where: { userId } }),
    prisma.salarySubmission.findMany({ where: { userId } }),
    prisma.talentProfile.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        services: true,
        portfolios: true,
        certifications: true,
        awards: true,
      },
    }),
    prisma.recruiterProfile.findUnique({ where: { userId } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.payment.findMany({ where: { userId } }),
    prisma.notification.findMany({ where: { userId }, take: 1000 }),
    prisma.feedback.findMany({ where: { userId } }),
  ]);

  // Hydrate CareerGPS nested rows by session ids.
  const careerGpsSessionIds = careerGpsSessions.map((s) => s.id);
  const [careerGpsQuestionnaires, careerGpsGoals, careerGpsPlans, careerGpsCvs] = await Promise.all([
    careerGpsSessionIds.length
      ? prisma.careerGPSQuestionnaire.findMany({ where: { sessionId: { in: careerGpsSessionIds } } })
      : Promise.resolve([]),
    careerGpsSessionIds.length
      ? prisma.careerGPSGoal.findMany({ where: { sessionId: { in: careerGpsSessionIds } } })
      : Promise.resolve([]),
    careerGpsSessionIds.length
      ? prisma.careerGPSPlan.findMany({ where: { sessionId: { in: careerGpsSessionIds } } })
      : Promise.resolve([]),
    careerGpsSessionIds.length
      ? prisma.careerGPSCV.findMany({ where: { sessionId: { in: careerGpsSessionIds } } })
      : Promise.resolve([]),
  ]);

  const payload = {
    _notes: {
      generated_at: new Date().toISOString(),
      scope:
        "All Career Studio records tied to your user id. Anonymised aggregate analytics (share-view counters with the ownerId cleared) are NOT included.",
      blob_storage:
        "Uploaded resume PDFs and profile images live in cloud storage. URLs are included in cv_documents and talent_profile; download the binaries directly from those URLs.",
      contact:
        "If anything looks wrong or missing, email privacy@careerstudio.lk before you submit a deletion request — we can investigate the discrepancy.",
    },
    user,
    profile,
    resumes,
    gcv_resumes: gcvResumes,
    cover_letters: coverLetters,
    cv_documents: cvDocuments,
    linkedin_audits: linkedInAudits,
    career_gps: {
      sessions: careerGpsSessions,
      questionnaires: careerGpsQuestionnaires,
      goals: careerGpsGoals,
      plans: careerGpsPlans,
      cvs: careerGpsCvs,
    },
    job_applications: jobApplications,
    practice_sessions: practiceSessions,
    saved_questions: savedQuestions,
    salary_submissions: salarySubmissions,
    talent_profile: talentProfile,
    recruiter_profile: recruiterProfile,
    subscription: subscriptions,
    payments,
    notifications,
    feedback,
  };

  const filename = `career-studio-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
