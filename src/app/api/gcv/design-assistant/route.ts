import { generateObject } from "ai";
import { z } from "zod";
import { geminiModel } from "@/lib/ai";
import { NextResponse } from "next/server";

const gcvDesignSuggestionSchema = z.object({
  theme: z.enum(["professional", "creative", "minimalist", "bold"]),
  primaryColor: z.string().describe("Hex code for primary color"),
  secondaryColor: z.string().describe("Hex code for secondary color"),
  fontPairing: z.string().describe("Recommended font pairing (e.g. Inter / Merriweather)"),
  layoutSuggestion: z.string().describe("A brief suggestion on how to lay out the sections"),
  customSections: z.array(z.string()).describe("Suggested custom sections based on the profile (e.g. 'Key Projects', 'Publications')"),
});

export async function POST(req: Request) {
  try {
    const { profileData, targetIndustry } = await req.json();

    const prompt = `You are an AI Design Assistant for Graphical CVs (GCVs).
Suggest a design theme, color palette, font pairing, layout, and custom sections for a user targeting the ${targetIndustry} industry.
Profile Context:
${JSON.stringify(profileData).slice(0, 1000)}`;

    const response = await generateObject({
      model: geminiModel,
      schema: gcvDesignSuggestionSchema,
      prompt,
    });

    return NextResponse.json(response.object);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate design suggestions" },
      { status: 500 }
    );
  }
}
