import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildGcvPlainHtml } from "@/lib/gcv-export";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  const { resumeId } = await context.params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resume = await prisma.gCVResume.findFirst({ where: { id: resumeId, userId: session.user.id } });
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
    await page.setContent(buildGcvPlainHtml({ title: resume.title, contentJson: resume.contentJson, themeJson: resume.themeJson }), { waitUntil: "networkidle" });
    const buffer = await page.screenshot({ type: "png", fullPage: true });
    await browser.close();
    await prisma.gCVExport.create({ data: { resumeId, format: "png", filePath: `/api/gcv/${resumeId}/export/png` } });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-z0-9-]+/gi, "_")}.png"`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "PNG export requires Playwright browser binaries. Run `npx playwright install chromium` on the server.",
      detail: error instanceof Error ? error.message : "Unknown export error",
    }, { status: 503 });
  }
}
