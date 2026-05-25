import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { PlanTier } from "@prisma/client";

export const scheduleLinkedInReAudits = inngest.createFunction(
  { id: "schedule-linkedin-reaudits" },
  { cron: "0 0 * * 1" }, // Run every Monday at midnight
  async ({ step }) => {
    // 1. Fetch Premium Users
    const premiumProfiles = await step.run("fetch-premium-users", async () => {
      return prisma.userProfile.findMany({
        where: { planTier: PlanTier.premium },
        select: { userId: true },
      });
    });

    const userIds = premiumProfiles.map(p => p.userId);

    // 2. Queue re-audits for each premium user
    // Note: A real implementation would trigger a worker event for each, 
    // passing the user's latest linkedIn URL or stored profile text.
    await step.run("queue-reaudits", async () => {
      const events = userIds.map(userId => ({
        name: "linkedin/reaudit.trigger" as const,
        data: { userId },
      }));
      
      if (events.length > 0) {
        await inngest.send(events);
      }
    });

    return { queuedCount: userIds.length };
  }
);
