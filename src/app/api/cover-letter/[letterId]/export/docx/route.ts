import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCoverLetterContent } from "@/lib/resume-content";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ letterId: string }> }) {
  const session = await auth();
  const { letterId } = await context.params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const letter = await prisma.coverLetter.findFirst({
    where: { id: letterId, userId: session.user.id },
  });
  if (!letter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = parseCoverLetterContent(letter.content);
  const document = new Document({
    sections: [
      {
        children: [
          ...(content.subject ? [new Paragraph({ text: `Subject: ${content.subject}` })] : []),
          new Paragraph({ text: content.headerContact }),
          new Paragraph({ text: content.recipientDetails }),
          new Paragraph({ text: content.opener }),
          ...content.bodyParagraphs.map((paragraph) => new Paragraph({ text: paragraph })),
          ...(content.achievements.length
            ? [new Paragraph({ text: "Key Achievements", heading: HeadingLevel.HEADING_2 }), ...content.achievements.map((achievement) => new Paragraph({ text: achievement, bullet: { level: 0 } }))]
            : []),
          ...(content.salaryExpectation ? [new Paragraph({ text: content.salaryExpectation })] : []),
          new Paragraph({ text: content.closing }),
          new Paragraph({ text: content.signature }),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(document);

  return new NextResponse(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${letter.title.replace(/[^a-z0-9-]+/gi, "_")}.docx"`,
    },
  });
}
