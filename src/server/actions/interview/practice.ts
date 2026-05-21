"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateJsonWithGemini } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const feedbackSchema = z.object({
  score: z.number().min(1).max(10),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  sample_answer: z.string().default(""),
  tips: z.array(z.string()).default([]),
});

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().trim().min(10).max(5000),
  timeTaken: z.number().int().min(0).max(7200).default(0),
});

const submitTurnSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().trim().min(5).max(5000),
  history: z.array(z.object({
    role: z.enum(["interviewer", "candidate"]),
    text: z.string()
  })).default([]),
  timeTaken: z.number().int().min(0).max(7200).default(0),
  isFinalTurn: z.boolean().default(false)
});

export type InterviewFeedbackResult = z.infer<typeof feedbackSchema>;

function fallbackFeedback(answer: string): InterviewFeedbackResult {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = Math.min(7, Math.max(3, Math.floor(wordCount / 20)));
  return {
    score,
    strengths: wordCount > 50 ? ["Good level of detail in your response"] : [],
    improvements: wordCount < 30 ? ["Your answer could be more detailed", "Try to give specific examples"] : wordCount > 200 ? ["Consider being more concise"] : [],
    sample_answer: "",
    tips: ["Use the STAR method for behavioral questions", "Quantify your achievements where possible", "Practice speaking your answers out loud"],
  };
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/en/auth/sign-in");
  }

  return session.user;
}

export async function submitInterviewAnswerAction(input: z.infer<typeof submitAnswerSchema>) {
  const user = await requireUser();
  const parsed = submitAnswerSchema.parse(input);
  const question = await prisma.interviewQuestion.findFirst({
    where: { id: parsed.questionId, isActive: true },
  });

  if (!question) {
    throw new Error("Question not found");
  }

  const prompt = `You are an experienced interview coach. Analyze this interview response and provide structured feedback.

Interview Question: ${question.questionText}
Category: ${question.category}

Candidate's Answer:
${parsed.answer}

Provide feedback in this exact JSON format:
{
  "score": <number 1-10>,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "sample_answer": "A brief model answer for comparison (2-3 sentences)",
  "tips": ["specific tip 1", "specific tip 2"]
}

Be constructive, specific, and encouraging. Score fairly but honestly.`;

  let feedback = fallbackFeedback(parsed.answer);
  try {
    feedback = feedbackSchema.parse(await generateJsonWithGemini(prompt, feedbackSchema));
  } catch {
    feedback = fallbackFeedback(parsed.answer);
  }

  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      category: question.category,
      difficulty: question.difficulty,
      numQuestions: 1,
      questionsAnswered: 1,
      timeSpent: parsed.timeTaken,
      completed: true,
      completedAt: new Date(),
    },
  });

  await prisma.userResponse.create({
    data: {
      sessionId: session.id,
      questionId: question.id,
      userAnswer: parsed.answer,
      timeTaken: parsed.timeTaken,
      aiFeedback: JSON.stringify(feedback),
      aiScore: feedback.score * 10,
    },
  });

  await prisma.interviewQuestion.update({
    where: { id: question.id },
    data: { timesPracticed: { increment: 1 } },
  });

  return feedback;
}

export async function submitInterviewTurnAction(input: z.infer<typeof submitTurnSchema>) {
  const user = await requireUser();
  const parsed = submitTurnSchema.parse(input);
  const question = await prisma.interviewQuestion.findFirst({
    where: { id: parsed.questionId, isActive: true },
  });

  if (!question) {
    throw new Error("Question not found");
  }

  const conversationHistory = parsed.history
    .map(m => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.text}`)
    .join("\n");

  const prompt = `You are an expert interview coach conducting a turn-based mock interview.
The primary interview topic/question is: "${question.questionText}" (Category: ${question.category})

Here is the conversation so far:
${conversationHistory}
Candidate's latest answer: "${parsed.answer}"

${parsed.isFinalTurn 
  ? "This is the final turn. Provide detailed feedback and final scores for their overall performance." 
  : "Evaluate their latest answer. Provide feedback and then ask a natural, challenging follow-up question related to their response to keep the conversation going."}

Respond in the exact JSON format:
{
  "feedback": {
    "score": <number 1-10>,
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["improvement 1", "improvement 2"],
    "tips": ["specific tip 1", "specific tip 2"],
    "sample_answer": "A brief model answer for comparison"
  },
  "followUpQuestion": ${parsed.isFinalTurn ? "null" : '"Next follow-up question as a string"'}
}

Keep followUpQuestion challenging, relevant to their experience, and constructive.`;

  let responseJson = {
    feedback: fallbackFeedback(parsed.answer),
    followUpQuestion: parsed.isFinalTurn ? null : "Could you elaborate on how you handled the challenges in that situation?"
  };

  try {
    const aiSchema = z.object({
      feedback: feedbackSchema,
      followUpQuestion: z.string().nullable()
    });
    const rawResult = await generateJsonWithGemini(prompt, aiSchema);
    responseJson = aiSchema.parse(rawResult);
  } catch (error) {
    console.error("Gemini turn-based check failed:", error);
  }

  // Increment practice counter
  await prisma.interviewQuestion.update({
    where: { id: question.id },
    data: { timesPracticed: { increment: 1 } },
  });

  return responseJson;
}
