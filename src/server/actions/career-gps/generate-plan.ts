"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { type CareerGpsInputProfile } from "@/lib/career-gps-insights";
import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";

const careerGpsFormSchema = z.object({
  currentProfile: z.string().trim().min(20).max(10000),
  identityStory: z.string().trim().max(10000).default(""),
  experienceLevel: z.string().trim().max(120).default(""),
  constraints: z.string().trim().max(2000).default(""),
  learningStyle: z.string().trim().max(120).default(""),
  primaryRole: z.string().trim().min(2).max(255),
  secondaryRole: z.string().trim().max(255).default(""),
  timeframe: z.enum(["TWO_WEEKS", "THREE_MONTHS", "ONE_YEAR"]).default("THREE_MONTHS"),
  ambitionMode: z.enum(["local", "global", "hybrid"]).default("local"),
  sectorPreference: z.enum(["private", "public", "either"]).default("either"),
  alStream: z.string().trim().max(120).default(""),
  familyExpectation: z.coerce.number().int().min(0).max(10).default(5),
  diasporaMode: z.boolean().default(false),
  languageMode: z.enum(["en", "si", "ta"]).default("en"),
  hollandCode: z.string().trim().max(3).default(""),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireUser(locale: Locale) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  return session.user;
}



export async function generateCareerGpsPlanAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = careerGpsFormSchema.parse({
    currentProfile: formValue(formData, "currentProfile"),
    identityStory: formValue(formData, "identityStory"),
    experienceLevel: formValue(formData, "experienceLevel"),
    constraints: formValue(formData, "constraints"),
    learningStyle: formValue(formData, "learningStyle"),
    primaryRole: formValue(formData, "primaryRole"),
    secondaryRole: formValue(formData, "secondaryRole"),
    timeframe: formValue(formData, "timeframe") || "THREE_MONTHS",
    ambitionMode: formValue(formData, "ambitionMode") || "local",
    sectorPreference: formValue(formData, "sectorPreference") || "either",
    alStream: formValue(formData, "alStream"),
    familyExpectation: formValue(formData, "familyExpectation") || "5",
    diasporaMode: formData.get("diasporaMode") === "on",
    languageMode: formValue(formData, "languageMode") || "en",
    hollandCode: formValue(formData, "hollandCode"),
  });
  const story = [parsed.identityStory, parsed.currentProfile].filter(Boolean).join("\n\n");
  const session = await prisma.careerGPSSession.create({
    data: {
      userId: user.id,
      status: "GENERATING",
    },
  });

  const inputProfile: CareerGpsInputProfile = {
    story,
    primaryRole: parsed.primaryRole,
    secondaryRole: parsed.secondaryRole,
    experienceLevel: parsed.experienceLevel,
    constraints: parsed.constraints,
    learningStyle: parsed.learningStyle,
    ambitionMode: parsed.ambitionMode,
    sectorPreference: parsed.sectorPreference,
    alStream: parsed.alStream,
    familyExpectation: parsed.familyExpectation,
    diasporaMode: parsed.diasporaMode,
    languageMode: parsed.languageMode,
    hollandCode: parsed.hollandCode,
  };

  await prisma.careerGPSCV.create({
    data: {
      sessionId: session.id,
      text: parsed.currentProfile,
      dataJson: { experienceLevel: parsed.experienceLevel, identityStory: parsed.identityStory, languageMode: parsed.languageMode },
    },
  });
  
  const questions = {};
  const goals = {};
  
  await prisma.careerGPSQuestionnaire.create({
    data: {
      sessionId: session.id,
      answers: questions,
    },
  });
  await prisma.careerGPSGoal.create({
    data: {
      sessionId: session.id,
      targetRole: parsed.primaryRole,
      timeframe: parsed.timeframe,
      goalsJson: goals,
    },
  });

  await inngest.send({
    name: "career-gps/plan.generate",
    data: {
      sessionId: session.id,
      userId: user.id,
      inputProfile,
      questions,
      goals,
    },
  });

  redirect(`/${locale}/career-gps?session=${session.id}`);
}
