import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const systemPrompt = `You are a tough, realistic Sri Lankan Recruiter/Hiring Manager conducting a mock interview for the role of ${context.targetRole}. 
Your goal is to test the candidate's understanding of the role, their skills, and their alignment with the Sri Lankan market.
Keep your responses short, conversational, and direct. Ask one clear question at a time. Probe deeper into their answers if they are vague.`;

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
