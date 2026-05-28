import { NextResponse } from "next/server";
import { generateObject, generateText } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { extractStructuredJdKeywords } from "@/lib/linkedin-optimization";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";

const extractedKeywordsSchema = z.object({
  hard_skills: z.array(z.string()).default([]),
  soft_skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  seniority: z.string().default("Mid-Senior"),
});

export async function POST(req: Request) {
  const reqId = getRequestId(req);
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  const limited = await enforceRateLimit("scrape", req, session.user.id);
  if (limited) return limited;

  try {
    const { url } = await req.json();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 500 });
    }

    const html = await res.text();
    // Clean up HTML slightly to reduce token count
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 50000); // Limit size

    const response = await generateText({
      model: geminiModel,
      prompt: `You are an expert job board scraper.
Below is the cleaned text content from a job posting webpage at URL: ${url}.
Extract the exact Job Title, Company Name, and the complete Job Description details (responsibilities, requirements, skills).
Ignore navigation headers, footer text, ads, or cookie notices.

Webpage Content:
${cleanedHtml}

Output ONLY the clean, structured job description text, formatted cleanly.`,
    });

    const jdText = response.text;

    let keywords = extractStructuredJdKeywords(jdText);
    try {
      const keywordsResponse = await generateObject({
        model: geminiModel,
        schema: extractedKeywordsSchema,
        prompt: `Analyze the following job description text.
Extract the key skills and keywords categorized into:
1. hard_skills: Core technical skills, engineering methodologies, specialized business skills.
2. soft_skills: Interpersonal skills, communication, leadership, problem solving.
3. certifications: Professional certifications, licenses, degrees.
4. tools: Softwares, programming languages, libraries, platforms, databases.
5. seniority: Seniority level (e.g. Junior, Mid, Senior, Lead, Executive, Intern).

Job Description Text:
${jdText}
`,
      });
      keywords = keywordsResponse.object;
    } catch {
      // Keep deterministic extraction if Gemini is unavailable.
    }

    return NextResponse.json(
      { jobDescription: jdText, keywords },
      { headers: { "x-request-id": reqId } },
    );
  } catch (error) {
    console.error("[linkedin-scrape-jd]", reqId, "scrape failed:", error);
    return NextResponse.json(
      { error: "Failed to scrape job description" },
      { status: 500, headers: { "x-request-id": reqId } },
    );
  }
}
