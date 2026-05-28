import { streamText } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";

export const runtime = "nodejs";

const streamFeedbackSchema = z.object({
  question: z.string().trim().min(5).max(2000),
  answer: z.string().trim().min(10).max(5000),
  category: z.string().trim().max(80).default("general"),
});

export async function POST(request: Request) {
  const reqId = getRequestId(request);
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  const limited = await enforceRateLimit("ai", request, session.user.id);
  if (limited) return limited;

  const parsed = streamFeedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers: { "x-request-id": reqId } },
    );
  }

  const result = streamText({
    model: geminiModel,
    prompt: `You are an experienced interview coach for Sri Lankan job seekers.
Give concise, constructive feedback on this answer while it is being reviewed.

Interview Question: ${parsed.data.question}
Category: ${parsed.data.category}

Candidate Answer:
${parsed.data.answer}

Return plain text with strengths, improvements, and one sharper sample phrasing.`,
  });

  return result.toTextStreamResponse();
}
