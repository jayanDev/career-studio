import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";

const rewriteMultiSchema = z.object({
  sectionType: z.string(),
  currentText: z.string(),
  targetRole: z.string(),
  targetJd: z.string().optional().default(""),
});

const multiVariantResponseSchema = z.object({
  visibility: z.string(),
  authority: z.string(),
  opportunity: z.string(),
  story: z.string(),
  clarity: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = rewriteMultiSchema.parse(body);

    const jdPrompt = parsed.targetJd
      ? `Additionally, align the output keywords with the following target Job Description:\n${parsed.targetJd.slice(0, 3000)}\n`
      : "";

    const prompt = `You are a world-class professional LinkedIn copywriter and career branding expert.
Optimize and rewrite the LinkedIn profile "${parsed.sectionType}" section for a candidate aiming to be a "${parsed.targetRole}".

Original Text:
"${parsed.currentText}"

${jdPrompt}
Generate exactly 5 distinct options corresponding to the following specific goals:

1. visibility: Highly keyword-dense, optimized for search algorithms and recruiters query matching (SEO-first).
2. authority: Tailored to showcase metrics, leadership, outcomes, and credibility. Highlight senior ownership and results.
3. opportunity: Active and inviting tone, optimized for indicating availability for hire, consulting, or partnerships (includes a clear CTA).
4. story: Engaging first-person narrative style with an intriguing hook, emotional/professional arc, and cohesive narrative flow.
5. clarity: Crisp, punchy, brief, and minimalist, conveying value in the shortest and sharpest way possible.

Return the 5 options in JSON matching the schema. Do not include markdown wraps or anything else. Just the raw JSON.`;

    const response = await generateObject({
      model: geminiModel,
      schema: multiVariantResponseSchema,
      prompt,
    });

    return NextResponse.json(response.object);
  } catch (error) {
    console.error("Multi-variant rewrite generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate multi-variant suggestions" },
      { status: 500 }
    );
  }
}
