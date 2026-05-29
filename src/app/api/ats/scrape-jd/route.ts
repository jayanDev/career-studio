import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { captureError } from "@/lib/observability";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";
import { isSafeUrl } from "@/lib/url-safety";

const scrapeBodySchema = z.object({
  url: z
    .string()
    .min(1, "url is required")
    .max(2048, "url too long")
    .refine(isSafeUrl, "url must be a public http(s) URL"),
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

  // Prevent the endpoint being used as an open scraper.
  const limited = await enforceRateLimit("scrape", req, session.user.id);
  if (limited) return limited;

  // Validate body shape before any I/O — catches SSRF attempts and
  // garbage payloads with a useful 400 instead of a generic 500.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400, headers: { "x-request-id": reqId } },
    );
  }
  const parsed = scrapeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      { status: 400, headers: { "x-request-id": reqId } },
    );
  }
  const { url } = parsed.data;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 502, headers: { "x-request-id": reqId } },
      );
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

    return NextResponse.json(
      { jobDescription: response.text },
      { headers: { "x-request-id": reqId } },
    );
  } catch (error) {
    captureError(error, {
      requestId: reqId,
      feature: "ats:scrape-jd",
      extra: { host: new URL(url).hostname },
    });
    return NextResponse.json(
      { error: "Failed to scrape job description" },
      { status: 500, headers: { "x-request-id": reqId } },
    );
  }
}
