import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getResumePlainTextForExport } from "@/server/services/resumes/export-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  const { resumeId } = await context.params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resume = await getResumePlainTextForExport(session.user.id, resumeId);
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = resume.content;
  const children = [
    new Paragraph({ text: content.header.fullName || resume.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: content.header.title }),
    new Paragraph({ text: [content.header.email, content.header.phone, content.header.location].filter(Boolean).join(" | ") }),
    new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: content.summary }),
    new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }),
    ...content.experience.flatMap((item) => [
      new Paragraph({ children: [new TextRun({ text: [item.title, item.company].filter(Boolean).join(" - "), bold: true })] }),
      ...item.bullets.filter(Boolean).map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } })),
    ]),
    new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }),
    ...content.education.map((item) => new Paragraph({ text: [item.degree, item.field, item.institution].filter(Boolean).join(" - ") })),
    new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }),
    ...(content.settings?.showSkillRatings && content.skillRatings.length
      ? content.skillRatings.map((skill) => new Paragraph({ text: `${skill.name} (${skill.rating}/5)` }))
      : [new Paragraph({ text: content.skills.join(", ") })]),
    ...(content.projects.length
      ? [
          new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 }),
          ...content.projects.flatMap((item) => [
            new Paragraph({ children: [new TextRun({ text: item.name, bold: true })] }),
            new Paragraph({ text: item.description }),
            new Paragraph({ text: item.technologies.join(", ") }),
          ]),
        ]
      : []),
    ...(content.certifications.length
      ? [
          new Paragraph({ text: "Certifications", heading: HeadingLevel.HEADING_2 }),
          ...content.certifications.map((item) => new Paragraph({ text: [item.name, item.issuer, item.date].filter(Boolean).join(" - ") })),
        ]
      : []),
    ...(content.languages.length
      ? [
          new Paragraph({ text: "Languages", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: content.languages.map((item) => [item.name, item.proficiency].filter(Boolean).join(" - ")).join(", ") }),
        ]
      : []),
    ...(content.awards.length
      ? [
          new Paragraph({ text: "Awards", heading: HeadingLevel.HEADING_2 }),
          ...content.awards.map((item) => new Paragraph({ text: [item.name, item.issuer, item.date].filter(Boolean).join(" - ") })),
        ]
      : []),
    ...(content.publications.length
      ? [
          new Paragraph({ text: "Publications", heading: HeadingLevel.HEADING_2 }),
          ...content.publications.map((item) => new Paragraph({ text: [item.title, item.publisher, item.date, item.url].filter(Boolean).join(" - ") })),
        ]
      : []),
    ...(!content.settings?.hideReferences && content.references.length
      ? [
          new Paragraph({ text: "References", heading: HeadingLevel.HEADING_2 }),
          ...content.references.map((item) => new Paragraph({ text: [item.name, item.title, item.organization, item.phone, item.email].filter(Boolean).join(" - ") })),
        ]
      : []),
  ];
  const document = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(document);

  return new NextResponse(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-z0-9-]+/gi, "_")}.docx"`,
    },
  });
}
