"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GDPR right-to-erasure: permanently delete the user's account and
 * every record tied to them.
 *
 * Most relations are configured with `onDelete: Cascade` at the
 * Prisma level so removing the User row triggers a cascading delete
 * of resumes, cover letters, ATS scans, job applications, etc. The
 * transaction here does the upstream cleanups that Prisma can't (or
 * shouldn't) handle automatically:
 *
 *   - SharedView analytics that reference the user as `ownerId`
 *     (we keep the row but anonymise it so aggregate counts stay
 *     accurate without re-identifying)
 *   - File-blob references (CV documents, talent profile photos):
 *     left in place — the actual files live in cloud storage and
 *     we don't have a storage client wired here; flag in a TODO
 *     so the storage cleanup can run as an out-of-band job.
 *   - Auth.js account links: cascaded via User.accounts relation.
 *
 * The user must explicitly type their email to confirm — the form
 * UI gates this and we re-verify here against the session.
 */
const inputSchema = z.object({
  /** The exact email the user typed in the confirm field. */
  confirmationEmail: z.string().email(),
  /** Optional free-text reason for analytics/feedback. */
  reason: z.string().max(500).optional(),
});

export type DeleteAccountInput = z.infer<typeof inputSchema>;

export async function deleteAccountAction(input: DeleteAccountInput) {
  const parsed = inputSchema.parse(input);

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/en/auth/sign-in");
  }

  if (parsed.confirmationEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    throw new Error("Confirmation email does not match your account email");
  }

  const userId = session.user.id;

  // Audit log first so we have a record even if the user re-signs up.
  // We deliberately keep this OUTSIDE the deletion transaction — if it
  // fails we still want to honour the deletion request.
  try {
    if (parsed.reason) {
      await prisma.feedback.create({
        data: {
          userId, // anonymised below before the user row is deleted
          type: "other",
          status: "new",
          title: "Account deletion reason",
          message: parsed.reason.slice(0, 500),
        },
      });
    }
  } catch (error) {
    console.warn("[delete-account] couldn't write feedback log:", error);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Anonymise share-view analytics owned by this user. We keep the
    //    rows for product analytics but break the link to the user id.
    await tx.shareView.updateMany({
      where: { ownerId: userId },
      data: { ownerId: null },
    });

    // 2. Anonymise feedback we already submitted on their behalf above
    //    (and any historical feedback) so it survives the cascade.
    await tx.feedback.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // 3. Delete the user. Cascading relations clean up everything else:
    //    - sessions, accounts, authenticators
    //    - profile, resumes, GCV resumes, cover letters
    //    - ATS scans, LinkedIn audits, career-gps sessions
    //    - talent profile, recruiter profile, projects, outreach
    //    - subscriptions, payments
    //    - notifications, messages, forum activity
    await tx.user.delete({ where: { id: userId } });
  });

  // Sign out and redirect home. Wrapped in try because sign-out can throw
  // if the cookie store can't be written from this context — the account
  // is already deleted by that point, so it's only a UX issue.
  try {
    await signOut({ redirect: false });
  } catch (error) {
    console.warn("[delete-account] sign-out after delete failed:", error);
  }
  redirect("/?account_deleted=1");
}
