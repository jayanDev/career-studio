import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateJsonWithGemini } from "@/lib/ai";

const requestSchema = z.object({
  profileText: z.string().max(8000).default(""),
  targetRole: z.string().max(160).default("Professional"),
  audienceMode: z.enum(["local", "global"]).default("global"),
  language: z.enum(["en", "si", "ta"]).default("en"),
});

const responseSchema = z.object({
  story_post: z.string(),
  framework_post: z.string(),
  question_post: z.string(),
  case_study_post: z.string(),
  carousel_script: z.array(z.string()),
  hooks: z.array(z.string()),
  hashtags: z.array(z.string()),
  best_time_to_post: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.parse(await req.json());
  const fallback = {
    story_post: `A practical lesson from my ${parsed.targetRole} journey: progress usually comes from simplifying the problem before adding more tools.`,
    framework_post: `3 checks I use before starting important work:\n1. What outcome matters?\n2. Who needs to be aligned?\n3. How will we measure improvement?`,
    question_post: `What is one skill every ${parsed.targetRole} should build this year? My vote: clearer communication around tradeoffs.`,
    case_study_post: `Problem: unclear handoffs slowed delivery.\nSolution: define owners, checkpoints, and review rhythm.\nResult: fewer surprises and better team confidence.`,
    carousel_script: [
      "Slide 1: The problem most teams miss",
      "Slide 2: Why it matters",
      "Slide 3: Signal 1",
      "Slide 4: Signal 2",
      "Slide 5: Practical fix",
      "Slide 6: Example",
      "Slide 7: Checklist",
      "Slide 8: CTA",
    ],
    hooks: ["Most career advice skips the operational reality.", "Here is a small habit that changed how I work.", "The best teams I know do this differently."],
    hashtags: parsed.audienceMode === "local" ? ["#SriLankaCareers", "#ColomboTech", "#LKDev"] : ["#Careers", "#Leadership", "#Technology"],
    best_time_to_post: parsed.audienceMode === "local" ? "Mon-Wed 9-11am SLT or 7-9pm SLT" : "Weekday mornings in your target market timezone",
  };

  try {
    const result = await generateJsonWithGemini(
      `Generate LinkedIn content templates for this profile.
Target role: ${parsed.targetRole}
Audience: ${parsed.audienceMode}
Language: ${parsed.language}
Profile:
${parsed.profileText}

Return JSON with story_post, framework_post, question_post, case_study_post, carousel_script, hooks, hashtags, best_time_to_post.`,
      responseSchema
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallback);
  }
}
