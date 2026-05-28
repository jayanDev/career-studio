import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";

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
  const reqId = getRequestId(req);
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  const limited = await enforceRateLimit("ai", req, session.user.id);
  if (limited) return limited;

  let parsed: z.infer<typeof rewriteMultiSchema> | null = null;
  try {
    parsed = rewriteMultiSchema.parse(await req.json());

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

    return NextResponse.json(response.object, { headers: { "x-request-id": reqId } });
  } catch (error) {
    console.error("[linkedin-rewrite-multi]", reqId, "generation failed:", error);
    if (parsed) {
      return NextResponse.json(
        buildFallbackVariants(parsed.sectionType, parsed.currentText, parsed.targetRole),
        { headers: { "x-request-id": reqId } },
      );
    } else {
      return NextResponse.json(
        { error: "Failed to generate multi-variant suggestions" },
        { status: 500, headers: { "x-request-id": reqId } },
      );
    }
  }
}

function buildFallbackVariants(sectionType: string, currentText: string, targetRole: string) {
  const subject = sectionType === "headline" ? targetRole || "Career professional" : currentText.slice(0, 140);
  return {
    visibility: `${targetRole || "Professional"} | Search-optimized profile with role-relevant skills, measurable outcomes, and clear industry keywords`,
    authority: `${subject}\n\nI build credibility through measurable delivery, cross-functional ownership, and practical outcomes that improve team and business performance.`,
    opportunity: `${subject}\n\nOpen to conversations where my experience can help teams deliver better systems, clearer execution, and measurable results.`,
    story: `I help teams turn complex career and product problems into practical outcomes. My work combines hands-on execution, clear communication, and a bias for measurable progress.`,
    clarity: `${targetRole || "Professional"} focused on measurable outcomes, clean execution, and useful collaboration.`,
  };
}
