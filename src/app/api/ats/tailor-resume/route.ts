import { NextResponse } from "next/server";
import { generateText } from "ai";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";

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

  try {
    const { resumeText, jobDescription } = await req.json();
    if (!resumeText || !resumeText.trim()) {
      return NextResponse.json({ error: "Resume text is required" }, { status: 400 });
    }
    if (!jobDescription || !jobDescription.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const response = await generateText({
      model: geminiModel,
      prompt: `You are an expert executive resume writer and ATS optimization specialist.
Given the candidate's original resume and the target job description, rewrite and restructure the resume to tailor it specifically to the job description.

Job Description:
${jobDescription}

Original Resume:
${resumeText}

Tailoring Rules:
1. Re-order bullet points in experience sections to surface the most relevant accomplishments first.
2. Swap out weak verbs for powerful action verbs that mirror the keywords and responsibilities in the job description.
3. Align the skills section to surface the specific technical and soft skills highlighted in the job description.
4. Ensure formatting remains extremely clean, using standard markdown structure (Headers, bullet lists). Do not fabricate major details; adapt and optimize existing achievements honestly.

Output the tailored resume as clean markdown text.`,
    });

    return NextResponse.json(
      { tailoredText: response.text },
      { headers: { "x-request-id": reqId } },
    );
  } catch (error) {
    console.error("[ats-tailor-resume]", reqId, "tailor failed:", error);
    return NextResponse.json(
      { error: "Failed to tailor resume" },
      { status: 500, headers: { "x-request-id": reqId } },
    );
  }
}
