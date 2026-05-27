import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { generateJsonWithGemini } from "@/lib/ai";
import { careerGpsPlanResultSchema, type CareerGpsPlanResult } from "@/lib/career-gps";
import { buildCareerGpsEnhancements, type CareerGpsInputProfile } from "@/lib/career-gps-insights";
import { getCandidateResources } from "@/server/services/career-gps/resource-aggregator";
import { CareerTaskType, PlanTier } from "@prisma/client";

function weeksForPlan(planTier: PlanTier) {
  if (planTier === PlanTier.premium) return 52;
  if (planTier === PlanTier.pro) return 12;
  return 2;
}

function fallbackPlan(primaryRole: string, resources: Array<{ type: string; id: string; title: string }>): CareerGpsPlanResult {
  return careerGpsPlanResultSchema.parse({
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
  });
}

export const generateCareerGpsPlan = inngest.createFunction(
  { id: "generate-career-gps-plan" },
  { event: "career-gps/plan.generate" },
  // @ts-expect-error - inngest signature mismatch
  async ({ event, step }: any) => {
    const { sessionId, userId, inputProfile, questions, goals } = event.data;

    // 1. Fetch user's plan tier
    const profile = await step.run("fetch-user-profile", async () => {
      return prisma.userProfile.findUnique({ where: { userId }, select: { planTier: true } });
    });
    const planTier = profile?.planTier ?? PlanTier.basic;

    // 2. Fetch candidate resources
    const resources = await step.run("fetch-resources", async () => {
      return getCandidateResources([inputProfile.primaryRole, inputProfile.secondaryRole], 40);
    });

    // 3. Build AI Prompt
    const languageInstruction =
      inputProfile.languageMode === "si"
        ? "RESPOND IN SINHALA (සිංහල). Identity statement, pathway summaries, milestone titles, task titles, reasons, and check-in prompts MUST be written in Sinhala using Unicode (no transliteration). Keep keys/enums in English."
        : inputProfile.languageMode === "ta"
          ? "RESPOND IN TAMIL (தமிழ்). Identity statement, pathway summaries, milestone titles, task titles, reasons, and check-in prompts MUST be written in Tamil using Unicode (no transliteration). Keep keys/enums in English."
          : "RESPOND IN ENGLISH.";

    const prompt = `
        You are an expert World-Class Career Coach and Strategist.
        Create a personalized career roadmap for the user based on their Profile and Goals.

        ${languageInstruction}

        USER PROFILE:
        - Story and CV Summary: ${inputProfile.story.slice(0, 7000)}
        - Questionnaire: ${JSON.stringify(questions, null, 2)}
        - Goals: ${JSON.stringify(goals, null, 2)}

        AVAILABLE RESOURCES (Prioritize these):
        ${JSON.stringify(resources, null, 2)}

        OUTPUT SCHEMA (JSON Only):
        {
          "identity_statement": "You are someone who...",
          "plan_strength": {"score": 82, "label": "Strong direction, some week-level detail still missing", "reasons": ["..."]},
          "identity_profile": {"skills": [], "interests": [], "values": [], "motivations": [], "hidden_strengths": [], "holland_code": "IAS", "family_expectation": 5, "ambition_mode": "local"},
          "constellation": [
            {"id": "software-engineer", "role": "Software Engineer", "domain": "Tech", "match": 86, "x": 35, "y": 42, "summary": "...", "salary_lkr": "Rs 250k-500k/month", "difficulty": 72, "difficulty_label": "Moderate", "nearest_neighbours": ["..."]}
          ],
          "pathways": [
            {"type": "aligned", "role": "Target Role", "summary": "...", "risk": "...", "time_to_transition_months": 9, "salary_curve_lkr": [{"year": 1, "p25": 180000, "p75": 320000}], "public_sector_fit": "...", "private_sector_fit": "..."}
          ],
          "skill_overlap": {"current_skills": [], "target_skills": [], "transferable": [], "gaps": [], "drop_or_deprioritize": [], "overlap_pct": 50},
          "sl_context": {"al_stream_pathways": [], "industry_ladders": [], "certifications": [], "universities": [], "scholarships": [], "diaspora_bridge": "", "cost_of_living_note": "", "cultural_calendar_notes": []},
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
        4. Generate 8-15 constellation careers and 3 pathways: aligned, stretch, pivot.
        5. Include Sri Lanka-specific pathways when ambition_mode is local or hybrid.
        6. Return ONLY valid JSON.
        `;

    // 4. Generate AI Plan
    const generated = await step.run("generate-ai-plan", async () => {
      let aiResult = fallbackPlan(inputProfile.primaryRole, resources);
      try {
        aiResult = careerGpsPlanResultSchema.parse(await generateJsonWithGemini(prompt, careerGpsPlanResultSchema));
      } catch (err) {
        console.error("AI Generation failed:", err);
      }
      return buildCareerGpsEnhancements(inputProfile, aiResult);
    });

    // 5. Save to DB
    await step.run("save-plan-to-db", async () => {
      const plan = await prisma.careerGPSPlan.create({
        data: {
          sessionId,
          planJson: {
            ...generated,
            plan_tier_generated: planTier,
            max_weeks_unlocked: weeksForPlan(planTier as PlanTier),
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
              type: task.type as CareerTaskType,
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
                url: resources.find((candidate: any) => candidate.id === resource.id && candidate.title === resource.title)?.url ?? "",
              },
            });
          }
        }
      }

      await prisma.careerGPSSession.update({
        where: { id: sessionId },
        data: { status: "GENERATED" },
      });
    });

    return { success: true, sessionId };
  }
);
