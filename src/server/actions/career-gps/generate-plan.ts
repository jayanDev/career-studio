"use server";

import { redirect } from "next/navigation";
import { CareerTaskType, PlanTier } from "@prisma/client";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { generateJsonWithGemini } from "@/lib/ai";
import { careerGpsPlanResultSchema, type CareerGpsPlanResult } from "@/lib/career-gps";
import { prisma } from "@/lib/prisma";
import { getCandidateResources } from "@/server/services/career-gps/resource-aggregator";

const careerGpsFormSchema = z.object({
  currentProfile: z.string().trim().min(20).max(10000),
  experienceLevel: z.string().trim().max(120).default(""),
  constraints: z.string().trim().max(2000).default(""),
  learningStyle: z.string().trim().max(120).default(""),
  primaryRole: z.string().trim().min(2).max(255),
  secondaryRole: z.string().trim().max(255).default(""),
  timeframe: z.enum(["TWO_WEEKS", "THREE_MONTHS", "ONE_YEAR"]).default("THREE_MONTHS"),
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

function weeksForPlan(planTier: PlanTier) {
  if (planTier === PlanTier.premium) return 52;
  if (planTier === PlanTier.pro) return 12;
  return 2;
}

function fallbackPlan(primaryRole: string, resources: Array<{ type: string; id: string; title: string }>): CareerGpsPlanResult {
  return {
    career_paths: [{ role: primaryRole, match: 72, why: ["Your current profile has transferable skills", "The roadmap focuses on practical proof of ability"] }],
    skill_gaps: {
      must_learn: [
        { skill: "Portfolio evidence", reason: "Sri Lankan recruiters respond well to tangible examples of work" },
        { skill: "Interview storytelling", reason: "Clear STAR stories improve screening and final-round performance" },
      ],
      optional: [{ skill: "Networking cadence", reason: "Warm referrals improve response rates in Colombo hiring loops" }],
    },
    roadmap: {
      weeks: 12,
      milestones: [
        {
          week_start: 1,
          week_end: 2,
          title: "Foundations and positioning",
          description: "Clarify your target role, proof points, and learning plan.",
          tasks: [
            { week: 1, type: CareerTaskType.LEARN, title: `Map the top requirements for ${primaryRole}`, effort_minutes: 60, outcome: "A short skills gap list", resource_refs: resources.slice(0, 2) },
            { week: 2, type: CareerTaskType.BUILD, title: "Create one portfolio proof item", effort_minutes: 180, outcome: "A shareable project, case note, or work sample", resource_refs: resources.slice(2, 4) },
          ],
        },
        {
          week_start: 3,
          week_end: 6,
          title: "Proof and practice",
          description: "Turn learning into visible outcomes and rehearse interview stories.",
          tasks: [
            { week: 3, type: CareerTaskType.INTERVIEW, title: "Practice five role-relevant interview answers", effort_minutes: 90, outcome: "Recorded or written STAR answers", resource_refs: resources.slice(4, 6) },
            { week: 5, type: CareerTaskType.APPLY, title: "Apply to a focused shortlist", effort_minutes: 120, outcome: "Ten tailored applications tracked", resource_refs: [] },
          ],
        },
      ],
    },
  };
}

export async function generateCareerGpsPlanAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = careerGpsFormSchema.parse({
    currentProfile: formValue(formData, "currentProfile"),
    experienceLevel: formValue(formData, "experienceLevel"),
    constraints: formValue(formData, "constraints"),
    learningStyle: formValue(formData, "learningStyle"),
    primaryRole: formValue(formData, "primaryRole"),
    secondaryRole: formValue(formData, "secondaryRole"),
    timeframe: formValue(formData, "timeframe") || "THREE_MONTHS",
  });
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id }, select: { planTier: true } });
  const planTier = profile?.planTier ?? PlanTier.basic;
  const resources = await getCandidateResources([parsed.primaryRole, parsed.secondaryRole], 40);
  const questions = {
    experience_level: parsed.experienceLevel,
    constraints: parsed.constraints,
    learning_style: parsed.learningStyle,
  };
  const goals = {
    primary: parsed.primaryRole,
    secondary: parsed.secondaryRole,
    timeframe: parsed.timeframe,
  };
  const prompt = `
        You are an expert World-Class Career Coach and Strategist.
        Create a personalized career roadmap for the user based on their Profile and Goals.

        USER PROFILE:
        - CV Summary: ${parsed.currentProfile.slice(0, 5000)}
        - Questionnaire: ${JSON.stringify(questions, null, 2)}
        - Goals: ${JSON.stringify(goals, null, 2)}

        AVAILABLE RESOURCES (Prioritize these):
        ${JSON.stringify(resources, null, 2)}

        OUTPUT SCHEMA (JSON Only):
        {
          "career_paths": [
            {"role": "Target Role Name", "match": 85, "why": ["Reason 1", "Reason 2"]}
          ],
          "skill_gaps": {
            "must_learn": [{"skill": "Skill Name", "reason": "Reason"}],
            "optional": [{"skill": "Skill Name", "reason": "Reason"}]
          },
          "roadmap": {
            "weeks": 12,
            "milestones": [
              {
                "week_start": 1,
                "week_end": 2,
                "title": "Phase Title",
                "description": "Output Description",
                "tasks": [
                  {
                    "week": 1,
                    "type": "LEARN",
                    "title": "Task Title",
                    "effort_minutes": 60,
                    "outcome": "Measurable outcome",
                    "resource_refs": [ {"type": "COURSE", "id": "...", "title": "..."} ]
                  }
                ]
              }
            ]
          }
        }

        REQUIREMENTS:
        1. Be realistic. If the gap is huge, suggest intermediate roles.
        2. Use the provided resources if they match the learning needs.
        3. Structure the roadmap logically (Foundations -> Advanced -> Application).
        4. Return ONLY valid JSON.
        `;
  let generated = fallbackPlan(parsed.primaryRole, resources);
  try {
    generated = careerGpsPlanResultSchema.parse(await generateJsonWithGemini(prompt, careerGpsPlanResultSchema));
  } catch {
    generated = fallbackPlan(parsed.primaryRole, resources);
  }

  const session = await prisma.careerGPSSession.create({
    data: {
      userId: user.id,
      status: "GENERATED",
    },
  });
  await prisma.careerGPSCV.create({
    data: {
      sessionId: session.id,
      text: parsed.currentProfile,
      dataJson: { experienceLevel: parsed.experienceLevel },
    },
  });
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
  const plan = await prisma.careerGPSPlan.create({
    data: {
      sessionId: session.id,
      planJson: {
        ...generated,
        plan_tier_generated: planTier,
        max_weeks_unlocked: weeksForPlan(planTier),
      },
    },
  });

  for (const [milestoneIndex, milestone] of generated.roadmap.milestones.entries()) {
    const createdMilestone = await prisma.careerGPSMilestone.create({
      data: {
        planId: plan.id,
        weekStart: milestone.week_start,
        weekEnd: milestone.week_end,
        title: milestone.title,
        description: milestone.description,
        sortOrder: milestoneIndex,
      },
    });
    for (const [taskIndex, task] of milestone.tasks.entries()) {
      const createdTask = await prisma.careerGPSTask.create({
        data: {
          milestoneId: createdMilestone.id,
          week: task.week,
          type: task.type,
          title: task.title,
          effortMinutes: task.effort_minutes,
          outcome: task.outcome,
          sortOrder: taskIndex,
        },
      });
      for (const resource of task.resource_refs) {
        await prisma.careerGPSResourceLink.create({
          data: {
            taskId: createdTask.id,
            type: resource.type,
            objectId: resource.id,
            title: resource.title,
            url: resources.find((candidate) => candidate.id === resource.id && candidate.title === resource.title)?.url ?? "",
          },
        });
      }
    }
  }

  redirect(`/${locale}/career-gps?plan=${plan.id}`);
}
