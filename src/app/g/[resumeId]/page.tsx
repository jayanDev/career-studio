import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { GcvVisualPreview } from "@/components/feature/gcv/gcv-visual-preview";
import { Badge } from "@/components/ui/badge";
import { analyzeGcvDesign, parseGcvTheme } from "@/lib/gcv-design";
import { prisma } from "@/lib/prisma";
import { parseResumeContent } from "@/lib/resume-content";
import { recordShareView } from "@/lib/share-views";

type PublicGcvPageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function PublicGcvPage({ params }: PublicGcvPageProps) {
  const { resumeId } = await params;
  const resume = await prisma.gCVResume.findUnique({ where: { id: resumeId } });
  if (!resume) notFound();

  const content = parseResumeContent(resume.contentJson);
  const theme = parseGcvTheme(resume.themeJson);
  const design = analyzeGcvDesign(content, theme);
  await recordShareView({
    type: "gcv",
    itemId: resumeId,
    ownerId: resume.userId,
    headers: await headers(),
  });

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">{resume.title}</h1>
            <p className="text-sm text-neutral-600">Graphical CV web version</p>
          </div>
          <div className="flex gap-2">
            <Badge className="rounded-md bg-teal-700 text-white">{theme.template}</Badge>
            <Badge variant="outline" className="rounded-md">ATS estimate {design.atsScore}</Badge>
          </div>
        </div>
        <GcvVisualPreview content={content} theme={theme} publicView />
      </div>
    </main>
  );
}
