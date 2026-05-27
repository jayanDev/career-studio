import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { PlanTier } from "@prisma/client";

export const scheduleLinkedInReAudits = inngest.createFunction(
  {
    id: "schedule-linkedin-reaudits",
    triggers: [{ cron: "0 0 * * 1" }], // Every Monday at midnight UTC
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inngest step types vary by trigger
  async ({ step }: { step: any }) => {
    let skip = 0;
    const batchSize = 100;
    let totalQueued = 0;
    let hasMore = true;

    while (hasMore) {
      const userIds = await step.run(`fetch-premium-users-batch-${skip}`, async () => {
        const profiles = await prisma.userProfile.findMany({
          where: { planTier: PlanTier.premium },
          select: { userId: true },
          take: batchSize,
          skip: skip,
        });
        return profiles.map(p => p.userId);
      });

      if (userIds.length === 0) {
        hasMore = false;
        break;
      }

      await step.run(`queue-reaudits-batch-${skip}`, async () => {
        // Send events in chunks of 50 to avoid Inngest payload limits
        for (let i = 0; i < userIds.length; i += 50) {
          const chunk = userIds.slice(i, i + 50);
          const events = chunk.map((userId: string) => ({
            name: "linkedin/reaudit.trigger" as const,
            data: { userId },
          }));
          await inngest.send(events);
        }
      });

      totalQueued += userIds.length;
      skip += batchSize;
    }

    return { queuedCount: totalQueued };
  }
);
