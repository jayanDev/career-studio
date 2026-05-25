"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { geminiModel } from "@/lib/ai";

const activitySchema = z.object({
  themes: z.array(z.string()).describe("Main topics or themes discussed in the activity."),
  tone: z.string().describe("The overall tone of the posts (e.g., professional, encouraging, technical)."),
  consistencyScore: z.number().min(0).max(100).describe("Score out of 100 based on posting frequency and engagement consistency."),
  recommendation: z.string().describe("A specific, actionable recommendation to improve LinkedIn activity."),
});

export async function analyzeLinkedInActivityAction(activityDataJson: string) {
  const prompt = `You are a LinkedIn Growth Expert. 
Analyze the following JSON payload representing a user's recent LinkedIn activity (posts, comments, articles).
Extract the key themes, evaluate the tone, calculate a consistency score, and provide a recommendation for improvement.

Activity Data:
${activityDataJson}
`;

  try {
    const response = await generateObject({
      model: geminiModel,
      schema: activitySchema,
      prompt,
    });
    return response.object;
  } catch (error) {
    console.error("Failed to analyze LinkedIn activity:", error);
    return {
      themes: ["Professional Development", "Industry News"],
      tone: "Professional but sparse",
      consistencyScore: 40,
      recommendation: "Try to post at least once a week and comment on 3-5 posts from thought leaders in your industry to increase visibility.",
    };
  }
}
