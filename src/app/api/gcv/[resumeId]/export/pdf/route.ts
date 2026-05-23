import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildGcvPlainHtml } from "@/lib/gcv-export";
import { parseGcvTheme } from "@/lib/gcv-design";
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
    const theme = parseGcvTheme(resume.themeJson);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(buildGcvPlainHtml({ title: resume.title, contentJson: resume.contentJson, themeJson: resume.themeJson }), { waitUntil: "networkidle" });
    const buffer = await page.pdf({
      format: theme.paper,
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    await browser.close();
    await prisma.gCVExport.create({ data: { resumeId, format: "pdf", filePath: `/api/gcv/${resumeId}/export/pdf` } });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-z0-9-]+/gi, "_")}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "PDF export requires Playwright browser binaries. Run `npx playwright install chromium` on the server.",
      detail: error instanceof Error ? error.message : "Unknown export error",
    }, { status: 503 });
  }
}
