import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bullet, context } = await req.json();
    if (!bullet || bullet.trim().length < 3) {
      return NextResponse.json({ error: "Invalid bullet point" }, { status: 400 });
    }

    const response = await generateObject({
      model: geminiModel,
      schema: z.object({
        rewrites: z.array(z.string()).length(3),
      }),
      prompt: `You are an expert resume writer specializing in high-impact resume metrics, benchmarked against Resume Worded and VMock.
Rewrite the following weak resume bullet point into exactly three high-impact options following the Google XYZ / STAR format:
"Accomplished [X] as measured by [Y], by doing [Z]"

Weak Bullet Point:
"${bullet}"

Additional Context/Role details:
"${context || "Not provided"}"

Guidelines:
- Start with strong action verbs.
- Include plausible metrics or numeric placeholders (e.g. "by 15%", "for 1,200+ users") if not specified in the original bullet.
- Ensure the result is concise, professional, and optimized for Applicant Tracking Systems.`,
    });

    return NextResponse.json(response.object);
  } catch (error) {
    console.error("AI bullet rewrite failed:", error);
    return NextResponse.json({ error: "Failed to rewrite bullet point" }, { status: 500 });
  }
}
