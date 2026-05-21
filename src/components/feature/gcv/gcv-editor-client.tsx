"use client";

import { useState } from "react";

import { ResumePreview } from "@/components/feature/resumes/resume-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n-config";
import type { ResumeContent } from "@/lib/resume-content";
import { updateGcvResumeAction } from "@/server/actions/resumes/create-resume";

type GcvTheme = {
  accent: string;
  density: "compact" | "comfortable" | "spacious";
  template: string;
};

export function GcvEditorClient({
  locale,
  resumeId,
  title,
  talentSlug,
  initialContent,
  initialTheme,
  labels,
}: {
  locale: Locale;
  resumeId: string;
  title: string;
  talentSlug?: string;
  initialContent: ResumeContent;
  initialTheme: GcvTheme;
  labels: {
    title: string;
    accent: string;
    density: string;
    template: string;
    summary: string;
    skills: string;
    save: string;
    preview: string;
  };
}) {
  const [content, setContent] = useState(initialContent);
  const [theme, setTheme] = useState(initialTheme);
  const saveAction = updateGcvResumeAction.bind(null, locale, resumeId);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="contentJson" value={JSON.stringify(content)} />
            <div className="space-y-2">
              <Label htmlFor="title">{labels.title}</Label>
              <Input id="title" name="title" defaultValue={title} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accent">{labels.accent}</Label>
                <select
                  id="accent"
                  name="accent"
                  value={theme.accent}
                  onChange={(event) => setTheme((current) => ({ ...current, accent: event.target.value }))}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="teal">Teal</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="density">{labels.density}</Label>
                <select
                  id="density"
                  name="density"
                  value={theme.density}
                  onChange={(event) => setTheme((current) => ({ ...current, density: event.target.value as GcvTheme["density"] }))}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>
            </div>
            <input type="hidden" name="template" value={theme.template} />
            <div className="space-y-2">
              <Label htmlFor="summary">{labels.summary}</Label>
              <Textarea id="summary" rows={5} value={content.summary} onChange={(event) => setContent((current) => ({ ...current, summary: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">{labels.skills}</Label>
              <Textarea
                id="skills"
                rows={4}
                value={content.skills.join("\n")}
                onChange={(event) => setContent((current) => ({ ...current, skills: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                {labels.save}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="border-teal-700 text-teal-700 hover:bg-teal-50"
              >
                Print PDF
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div>
        <h2 className="mb-3 font-semibold text-neutral-950">{labels.preview}</h2>
        <ResumePreview
          content={content}
          visual="graphic"
          talentSlug={talentSlug}
          locale={locale}
          className={theme.density === "compact" ? "p-5" : theme.density === "spacious" ? "p-10" : "p-8"}
        />
      </div>
    </div>
  );
}
