"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generateJsonWithGemini } from "@/lib/ai";
import { captureError } from "@/lib/observability";
import { auth } from "@/lib/auth";
import { careerGpsPlanResultSchema, type CareerGpsPlanResult } from "@/lib/career-gps";
import { prisma } from "@/lib/prisma";

/**
 * Career GPS refinement loop.
 *
 * Handles two related UX patterns over a single primitive:
 *   - What-if simulation: "What if I learn Python this year?" — adds a
 *     hypothetical constraint and regenerates.
 *   - Re-plan / iterate: "I don't like these suggestions, show me more" /
 *     "Skip the stretch pathway, show different options" — feedback-led
 *     regeneration of the existing plan.
 *
 * Both flow through the same Gemini call, passing the existing plan as
 * context so the model only changes what's needed.
 */

const refineInputSchema = z.object({
  planId: z.string().uuid(),
  refinement: z.string().min(3).max(800),
  /** Optional structured tags so the UI can offer presets. */
  kind: z.enum(["what_if", "more_options", "drop_pathway", "constraint"]).default("what_if"),
});

export type RefinementKind = z.infer<typeof refineInputSchema>["kind"];

export type RefineResponse = {
  planId: string;
  plan: CareerGpsPlanResult;
  appliedRefinement: string;
  method: "ai" | "fallback";
};

async function loadAndAuth(planId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorised");
  const userId = session.user.id;

  const plan = await prisma.careerGPSPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const parent = await prisma.careerGPSSession.findUnique({
    where: { id: plan.sessionId },
    select: { userId: true },
  });
  if (!parent || parent.userId !== userId) throw new Error("Plan not found");

  return plan;
}

function buildRefinementPreamble(kind: RefinementKind, refinement: string): string {
  switch (kind) {
    case "more_options":
      return `The user wants different career options than what the existing plan shows. Generate a meaningfully DIFFERENT constellation (avoid repeating the current top 5 careers) and at least one pathway the existing plan did not consider. User feedback: "${refinement}"`;
    case "drop_pathway":
      return `The user wants to drop a pathway from the existing plan and see alternatives. Regenerate the pathways array so the rejected option does not appear. User feedback: "${refinement}"`;
    case "constraint":
      return `The user is adding a new hard constraint to the plan (e.g. cannot relocate, must work remotely, fixed budget). Respect this constraint everywhere — pathways, roadmap, salary projections. New constraint: "${refinement}"`;
    case "what_if":
    default:
      return `The user is exploring a hypothetical. Re-generate the plan as if the hypothetical is true and surface what changes. Show how the constellation, pathways, skill_overlap and roadmap shift. Hypothetical: "${refinement}"`;
  }
}

export async function refineCareerPlanAction(input: {
  planId: string;
  refinement: string;
  kind?: RefinementKind;
}): Promise<RefineResponse> {
  const parsed = refineInputSchema.parse({
    planId: input.planId,
    refinement: input.refinement,
    kind: input.kind ?? "what_if",
  });

  const plan = await loadAndAuth(parsed.planId);
  const existing = careerGpsPlanResultSchema.parse(plan.planJson);

  const preamble = buildRefinementPreamble(parsed.kind, parsed.refinement);

  const prompt = `
You are refining an existing Career GPS plan. Apply the user feedback below and return a COMPLETE, REVISED plan — same JSON schema as the input, every field present. Do not invent new fields or drop fields.

${preamble}

RULES:
- Keep the identity_statement consistent unless the refinement directly contradicts it.
- Preserve plan_strength.label tone; recompute the score (0-100).
- Where the existing plan still makes sense, keep it. Where the refinement changes things, update concretely.
- If the refinement is impossible (e.g. "what if I'm a 5-year-old?"), explain in plan_strength.reasons rather than fabricating.

EXISTING PLAN (the baseline you are refining):
${JSON.stringify(existing).slice(0, 12000)}
`;

  let refined: CareerGpsPlanResult = existing;
  let method: RefineResponse["method"] = "ai";

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    method = "fallback";
  } else {
    try {
      const ai = await generateJsonWithGemini(prompt, careerGpsPlanResultSchema);
      refined = careerGpsPlanResultSchema.parse(ai);
    } catch (error) {
      // Falling back to the prior plan is benign UX but hides the cause
      // (quota, schema drift, prompt bug). Surface it.
      captureError(error, {
        feature: "career-gps:refine",
        extra: { planId: parsed.planId, refinementLength: parsed.refinement.length },
      });
      method = "fallback";
    }
  }

  // Persist back into the same row so the page picks it up on next load.
  await prisma.careerGPSPlan.update({
    where: { id: parsed.planId },
    data: { planJson: refined as unknown as object },
  });

  revalidatePath("/career-gps");
  return { planId: parsed.planId, plan: refined, appliedRefinement: parsed.refinement, method };
}
