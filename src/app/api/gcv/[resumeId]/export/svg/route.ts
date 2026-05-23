import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildGcvSvg } from "@/lib/gcv-export";
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

  const svg = buildGcvSvg({ title: resume.title, contentJson: resume.contentJson, themeJson: resume.themeJson });
  await prisma.gCVExport.create({ data: { resumeId, format: "svg", filePath: `/api/gcv/${resumeId}/export/svg` } });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-z0-9-]+/gi, "_")}.svg"`,
    },
  });
}
