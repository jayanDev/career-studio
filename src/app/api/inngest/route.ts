import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest";
import { sendNotificationDigests } from "@/server/inngest/notification-digests";
import { generateCareerGpsPlan } from "@/server/inngest/career-gps";
import { scheduleLinkedInReAudits } from "@/server/inngest/linkedin-cron";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendNotificationDigests, generateCareerGpsPlan, scheduleLinkedInReAudits],
});
