"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, BriefcaseBusiness, Download, ExternalLink, FileArchive, MailPlus, RefreshCcw, Save, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  coverLetterPlainText,
  coverLetterSentenceLibrary,
  coverLetterTemplateGallery,
  fillCoverLetterSentence,
  industryCoverLetterOpeners,
  scoreCoverLetter,
  suggestSendingWindow,
  type CoverLetterLanguage,
  type CoverLetterLengthTarget,
  type CoverLetterMode,
} from "@/lib/cover-letter-optimization";
import type { Locale } from "@/i18n-config";
import { coverLetterContentToText, type CoverLetterContent } from "@/lib/resume-content";
import {
  generateCoverLetterFollowUpAction,
  generateCoverLetterUtilityPackAction,
  generateCoverLetterVariantsAction,
  refineCoverLetterSectionAction,
  retargetCoverLetterAction,
  updateCoverLetterAction,
} from "@/server/actions/resumes/create-resume";

type CoverLetterEditorClientProps = {
  locale: Locale;
  letter: {
    id: string;
    title: string;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    tone: string;
  };
  initialContent: CoverLetterContent;
  saved: boolean;
  versionCount: number;
};

type SectionKey = "opener" | "body" | "achievement" | "closing";

export function CoverLetterEditorClient({ locale, letter, initialContent, saved, versionCount }: CoverLetterEditorClientProps) {
  const [content, setContent] = useState(initialContent);
  const [bodyText, setBodyText] = useState(initialContent.bodyParagraphs.join("\n\n"));
  const [achievementText, setAchievementText] = useState(initialContent.achievements.map((item) => `- ${item}`).join("\n"));
  const [variants, setVariants] = useState(initialContent.variants);
  const [followUps, setFollowUps] = useState(initialContent.followUpDrafts);
  const [emailReady, setEmailReady] = useState(initialContent.emailReady);
  const [linkedInDm, setLinkedInDm] = useState(initialContent.linkedInDm);
  const [comboPack, setComboPack] = useState(initialContent.comboPack);
  const [performance, setPerformance] = useState(initialContent.performance);
  const [retargetText, setRetargetText] = useState(letter.jobDescription);
  const [pendingLabel, setPendingLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const currentContent = useMemo(
    () => ({
      ...content,
      bodyParagraphs: bodyText.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean),
      achievements: achievementText.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean),
      variants,
      followUpDrafts: followUps,
      emailReady,
      linkedInDm,
      comboPack,
      performance,
    }),
    [achievementText, bodyText, comboPack, content, emailReady, followUps, linkedInDm, performance, variants]
  );
  const score = useMemo(
    () => scoreCoverLetter({
      content: currentContent,
      jobDescription: letter.jobDescription,
      jobTitle: letter.jobTitle,
      companyName: letter.companyName,
      lengthTarget: currentContent.lengthTarget,
    }),
    [currentContent, letter.companyName, letter.jobDescription, letter.jobTitle]
  );
  const saveAction = updateCoverLetterAction.bind(null, locale, letter.id);

  function setField<K extends keyof CoverLetterContent>(key: K, value: CoverLetterContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  function refine(section: SectionKey, text: string, instruction: string) {
    if (!text.trim()) return;
    setPendingLabel(`${section}-${instruction}`);
    startTransition(async () => {
      const result = await refineCoverLetterSectionAction({
        text,
        section: section === "achievement" ? "achievement" : section === "body" ? "body" : section,
        instruction,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: letter.jobDescription,
        tone: letter.tone,
        language: currentContent.language,
      });
      if (section === "opener") setField("opener", result.text);
      if (section === "body") setBodyText(result.text);
      if (section === "achievement") setAchievementText(result.text.split("\n").map((line) => line.startsWith("-") ? line : `- ${line}`).join("\n"));
      if (section === "closing") setField("closing", result.text);
      setPendingLabel("");
    });
  }

  function generateVariants() {
    setPendingLabel("variants");
    startTransition(async () => {
      const next = await generateCoverLetterVariantsAction({
        content: currentContent,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: letter.jobDescription,
      });
      setVariants(next);
      setPendingLabel("");
    });
  }

  function generateFollowUps() {
    setPendingLabel("follow-ups");
    startTransition(async () => {
      const next = await generateCoverLetterFollowUpAction({
        content: currentContent,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: letter.jobDescription,
      });
      setFollowUps(next);
      setPendingLabel("");
    });
  }

  function generateUtilityPack() {
    setPendingLabel("utility-pack");
    startTransition(async () => {
      const next = await generateCoverLetterUtilityPackAction({
        content: currentContent,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: letter.jobDescription,
      });
      setEmailReady(next.emailReady);
      setLinkedInDm(next.linkedInDm);
      setComboPack(next.comboPack);
      setPendingLabel("");
    });
  }

  function retarget() {
    if (retargetText.trim().length < 20) return;
    setPendingLabel("retarget");
    startTransition(async () => {
      const next = await retargetCoverLetterAction({
        content: currentContent,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: retargetText,
        tone: letter.tone,
      });
      setContent(next);
      setBodyText(next.bodyParagraphs.join("\n\n"));
      setAchievementText(next.achievements.map((item) => `- ${item}`).join("\n"));
      setPendingLabel("");
    });
  }

  function insertSentence(target: "opener" | "body" | "closing" | "achievement", template: string) {
    const sentence = fillCoverLetterSentence(template, {
      companyName: letter.companyName,
      jobTitle: letter.jobTitle,
    });
    if (target === "opener") setField("opener", sentence);
    if (target === "body") setBodyText((current) => [current, sentence].filter(Boolean).join("\n\n"));
    if (target === "closing") setField("closing", sentence);
    if (target === "achievement") setAchievementText((current) => [current, `- ${sentence}`].filter(Boolean).join("\n"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{letter.title}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {saved ? "Saved." : "Edit paragraphs, check JD match, generate variants, then export."} Version history: {versionCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/api/cover-letter/${letter.id}/export/pdf`}>
              <Download className="size-4" />
              PDF
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/api/cover-letter/${letter.id}/export/docx`}>
              <Download className="size-4" />
              DOCX
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/api/cover-letter/${letter.id}/export/bundle`}>
              <FileArchive className="size-4" />
              Bundle
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/cl/${letter.id}`} target="_blank">
              <ExternalLink className="size-4" />
              Share
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form action={saveAction} className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Cover Letter Sections</CardTitle>
                <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                  <Save className="size-4" />
                  Save version
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />
              <input type="hidden" name="followUpDraftsJson" value={JSON.stringify(followUps)} />
              <input type="hidden" name="emailReadyJson" value={JSON.stringify(emailReady)} />
              <input type="hidden" name="linkedInDm" value={linkedInDm} />
              <input type="hidden" name="comboPackJson" value={JSON.stringify(comboPack)} />
              <input type="hidden" name="performanceJson" value={JSON.stringify(performance)} />
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium text-neutral-600">
                  Length
                  <select
                    name="lengthTarget"
                    value={content.lengthTarget}
                    onChange={(event) => setField("lengthTarget", event.target.value as CoverLetterLengthTarget)}
                    className="h-9 rounded-md border bg-white px-3 text-sm"
                  >
                    <option value="short">Short</option>
                    <option value="standard">Standard</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-neutral-600">
                  Language
                  <select
                    name="language"
                    value={content.language}
                    onChange={(event) => setField("language", event.target.value as CoverLetterLanguage)}
                    className="h-9 rounded-md border bg-white px-3 text-sm"
                  >
                    <option value="en">English</option>
                    <option value="si">Sinhala</option>
                    <option value="ta">Tamil</option>
                    <option value="bilingual_si">English + Sinhala</option>
                    <option value="bilingual_ta">English + Tamil</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-neutral-600">
                  Mode
                  <select
                    name="mode"
                    value={content.mode}
                    onChange={(event) => setField("mode", event.target.value as CoverLetterMode)}
                    className="h-9 rounded-md border bg-white px-3 text-sm"
                  >
                    <option value="international">International</option>
                    <option value="local">Local SL</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_11rem_9rem]">
                <Input name="subject" value={content.subject} onChange={(event) => setField("subject", event.target.value)} placeholder="Subject line" />
                <select
                  name="templateKey"
                  value={content.templateKey}
                  onChange={(event) => setField("templateKey", event.target.value)}
                  className="h-9 rounded-md border bg-white px-3 text-sm"
                >
                  {coverLetterTemplateGallery.map((template) => (
                    <option key={template.key} value={template.key}>{template.name}</option>
                  ))}
                </select>
                <Input name="accentColor" value={content.accentColor} onChange={(event) => setField("accentColor", event.target.value)} />
              </div>

              <SectionEditor
                label="Header contact"
                name="headerContact"
                rows={2}
                value={content.headerContact}
                onChange={(value) => setField("headerContact", value)}
              />
              <SectionEditor
                label="Recipient details"
                name="recipientDetails"
                rows={3}
                value={content.recipientDetails}
                onChange={(value) => setField("recipientDetails", value)}
              />
              <SectionEditor
                label="Opener"
                name="opener"
                rows={4}
                value={content.opener}
                onChange={(value) => setField("opener", value)}
                onRefine={(instruction) => refine("opener", content.opener, instruction)}
                pending={isPending && pendingLabel.startsWith("opener")}
              />
              <SectionEditor
                label="Body paragraphs"
                name="bodyParagraphs"
                rows={9}
                value={bodyText}
                onChange={setBodyText}
                onRefine={(instruction) => refine("body", bodyText, instruction)}
                pending={isPending && pendingLabel.startsWith("body")}
              />
              <SectionEditor
                label="Achievements"
                name="achievements"
                rows={4}
                value={achievementText}
                onChange={setAchievementText}
                onRefine={(instruction) => refine("achievement", achievementText, instruction)}
                pending={isPending && pendingLabel.startsWith("achievement")}
              />
              <SectionEditor
                label="Salary / referee paragraph"
                name="salaryExpectation"
                rows={2}
                value={content.salaryExpectation}
                onChange={(value) => setField("salaryExpectation", value)}
              />
              <SectionEditor
                label="Closing"
                name="closing"
                rows={3}
                value={content.closing}
                onChange={(value) => setField("closing", value)}
                onRefine={(instruction) => refine("closing", content.closing, instruction)}
                pending={isPending && pendingLabel.startsWith("closing")}
              />
              <SectionEditor
                label="Signature"
                name="signature"
                rows={2}
                value={content.signature}
                onChange={(value) => setField("signature", value)}
              />
            </CardContent>
          </Card>
        </form>

        <aside className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Quality Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold text-neutral-950">{score.score}</div>
                <Badge className="rounded-md bg-teal-700 text-white">{score.label}</Badge>
              </div>
              <Progress value={score.score} className="h-2" />
              <p className="text-xs text-neutral-600">
                {score.wordCount} words. Target: {score.targetRange.min}-{score.targetRange.max}.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(score.components).map(([key, value]) => (
                  <div key={key} className="rounded-md bg-neutral-50 p-2">
                    <span className="block capitalize text-neutral-500">{key.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-semibold text-neutral-900">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>JD Keyword Match</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-600">{score.matchedKeywords.length} of {score.matchedKeywords.length + score.missingKeywords.length} priority keywords mentioned.</p>
              <div className="flex flex-wrap gap-1.5">
                {score.matchedKeywords.slice(0, 10).map((keyword) => (
                  <Badge key={keyword} className="rounded-md bg-emerald-100 text-emerald-800">{keyword}</Badge>
                ))}
                {score.missingKeywords.map((item) => (
                  <Badge key={item.keyword} variant="outline" className="rounded-md border-red-200 text-red-700">{item.keyword}</Badge>
                ))}
              </div>
              {score.missingKeywords.slice(0, 3).map((item) => (
                <p key={item.keyword} className="text-xs text-neutral-500">{item.keyword}: {item.placement}</p>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Coaching</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...score.suggestions, ...score.grammarIssues].slice(0, 8).map((suggestion) => (
                <p key={suggestion} className="rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">{suggestion}</p>
              ))}
              {!score.suggestions.length && !score.grammarIssues.length ? (
                <p className="text-sm text-neutral-600">No major issues found.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4 text-teal-700" />
                Sentence Library
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <LibraryGroup
                title="Openers"
                items={[...coverLetterSentenceLibrary.openers, ...Object.values(industryCoverLetterOpeners).flat()].slice(0, 12)}
                onInsert={(item) => insertSentence("opener", item)}
              />
              <LibraryGroup title="Achievements" items={coverLetterSentenceLibrary.achievements} onInsert={(item) => insertSentence("achievement", item)} />
              <LibraryGroup title="Closers" items={coverLetterSentenceLibrary.closers} onInsert={(item) => insertSentence("closing", item)} />
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4 text-teal-700" />
                Company Research
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentContent.companyResearch.length ? currentContent.companyResearch.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setBodyText((current) => [current, item.replace("Verify this against the current role before sending.", "").trim()].filter(Boolean).join("\n\n"))}
                  className="w-full rounded-md bg-neutral-50 p-2 text-left text-xs leading-5 text-neutral-700 hover:bg-teal-50"
                >
                  {item}
                </button>
              )) : <p className="text-sm text-neutral-600">No research hints saved yet. Re-tailor with a JD to generate them.</p>}
              <p className="rounded-md bg-blue-50 p-2 text-xs leading-5 text-blue-900">{suggestSendingWindow(currentContent.mode)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Variants and Follow-up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={generateVariants} disabled={isPending}>
                  <RefreshCcw className="size-4" />
                  3 alternatives
                </Button>
                <Button type="button" variant="outline" onClick={generateFollowUps} disabled={isPending}>
                  <MailPlus className="size-4" />
                  Follow-up
                </Button>
                <Button type="button" variant="outline" onClick={generateUtilityPack} disabled={isPending}>
                  <Send className="size-4" />
                  Combo pack
                </Button>
              </div>
              {variants.map((variant) => (
                <details key={variant.label} className="rounded-md border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">{variant.label}</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{variant.text}</p>
                </details>
              ))}
              {followUps.map((draft) => (
                <details key={draft.kind} className="rounded-md border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">{draft.subject}</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{draft.body}</p>
                </details>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Re-tailor to New JD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={5} value={retargetText} onChange={(event) => setRetargetText(event.target.value)} placeholder="Paste a new JD here to re-tailor this letter." />
              <Button type="button" variant="outline" onClick={retarget} disabled={isPending || retargetText.trim().length < 20}>
                <RefreshCcw className="size-4" />
                {pendingLabel === "retarget" ? "Re-tailoring..." : "Re-tailor"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Email, DM, Interview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {emailReady.subject ? (
                <details className="rounded-md border p-2 text-sm" open>
                  <summary className="cursor-pointer font-medium">Email-ready format</summary>
                  <p className="mt-2 text-xs font-medium text-neutral-500">{emailReady.subject}</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{emailReady.body}</p>
                </details>
              ) : null}
              {linkedInDm ? (
                <details className="rounded-md border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">LinkedIn DM</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{linkedInDm}</p>
                </details>
              ) : null}
              {comboPack.interviewQuestions.length ? (
                <details className="rounded-md border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">Interview questions and resume notes</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-neutral-600">
                    {comboPack.tailoredResumeNotes.map((item) => <li key={item}>{item}</li>)}
                    {comboPack.interviewQuestions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              ) : (
                <p className="text-sm text-neutral-600">Generate the combo pack to create an email body, LinkedIn DM, resume notes, and interview questions.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Performance Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Input type="date" value={performance.sentDate} onChange={(event) => setPerformance((current) => ({ ...current, sentDate: event.target.value }))} />
              {[
                ["replyReceived", "Reply received"],
                ["interviewReceived", "Interview received"],
                ["offerReceived", "Offer received"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    checked={Boolean(performance[key as keyof typeof performance])}
                    onChange={(event) => setPerformance((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-4 text-xs leading-6 text-neutral-800">
                {coverLetterContentToText(currentContent)}
              </pre>
              <p className="mt-2 text-xs text-neutral-500">Plain-text form copy: {coverLetterPlainText(currentContent).slice(0, 120)}...</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function LibraryGroup({ title, items, onInsert }: { title: string; items: string[]; onInsert: (item: string) => void }) {
  return (
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onInsert(item)}
            className="w-full rounded-md bg-neutral-50 p-2 text-left text-xs leading-5 text-neutral-600 hover:bg-teal-50"
          >
            {item}
          </button>
        ))}
      </div>
    </details>
  );
}

function SectionEditor({
  label,
  name,
  rows,
  value,
  onChange,
  onRefine,
  pending,
}: {
  label: string;
  name: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
  onRefine?: (instruction: string) => void;
  pending?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        {onRefine ? (
          <span className="flex flex-wrap gap-1">
            {["Improve", "Make shorter", "Make longer", "More formal"].map((instruction) => (
              <Button key={instruction} type="button" size="sm" variant="outline" disabled={pending} onClick={() => onRefine(instruction)}>
                <Sparkles className="size-3.5" />
                {pending ? "Working..." : instruction}
              </Button>
            ))}
          </span>
        ) : null}
      </div>
      <Textarea name={name} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
