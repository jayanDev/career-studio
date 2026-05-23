"use client";

import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, Gauge, Loader2, Plus, Trash2, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  scoreMultipleJdsAction,
  type MultiJdResponse,
} from "@/server/actions/ats/score-multi-jd";

type JdInput = { id: string; label: string; text: string };

let nextId = 0;
function makeId() {
  nextId += 1;
  return `jd_${nextId}_${Date.now()}`;
}

export function MultiJdClient() {
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jds, setJds] = useState<JdInput[]>([
    { id: makeId(), label: "", text: "" },
    { id: makeId(), label: "", text: "" },
  ]);
  const [result, setResult] = useState<MultiJdResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 5 * 1024 * 1024,
    onDrop: (accepted) => setFile(accepted[0] ?? null),
  });

  function addJd() {
    if (jds.length >= 6) return;
    setJds((prev) => [...prev, { id: makeId(), label: "", text: "" }]);
  }

  function removeJd(id: string) {
    setJds((prev) => (prev.length <= 1 ? prev : prev.filter((j) => j.id !== id)));
  }

  function updateJd(id: string, field: "label" | "text", value: string) {
    setJds((prev) => prev.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
  }

  function analyze() {
    setError(null);
    const populated = jds.filter((j) => j.text.trim().length > 0);
    if (populated.length === 0) {
      setError("Add at least one job description.");
      return;
    }
    if (!file && !resumeText.trim()) {
      setError("Upload or paste a resume to compare against.");
      return;
    }

    const formData = new FormData();
    formData.set("resumeText", resumeText);
    if (file) formData.set("resumeFile", file);
    populated.forEach((j, i) => {
      formData.set(`jd_${i}`, j.text);
      formData.set(`jd_label_${i}`, j.label || `JD ${i + 1}`);
    });

    startTransition(async () => {
      try {
        setResult(await scoreMultipleJdsAction(formData));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scoring failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${isDragActive ? "border-teal-500 bg-teal-50" : "border-neutral-200 bg-neutral-50"}`}
            >
              <input {...getInputProps()} />
              <FileUp className="size-8 text-teal-700" />
              <p className="mt-2 text-sm font-medium text-neutral-950">{file?.name ?? "Drop your CV here"}</p>
              <p className="mt-0.5 text-xs text-neutral-500">PDF, DOC, DOCX, TXT · 5MB</p>
            </div>
            <Textarea
              rows={6}
              placeholder="…or paste resume text"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Job descriptions ({jds.length}/6)</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addJd} disabled={jds.length >= 6}>
              <Plus className="size-3.5" /> Add JD
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {jds.map((j, i) => (
              <div key={j.id} className="rounded-md border bg-neutral-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    placeholder={`Label (e.g. "Sysco Labs - Senior SWE")`}
                    value={j.label}
                    onChange={(event) => updateJd(j.id, "label", event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeJd(j.id)}
                    disabled={jds.length <= 1}
                    aria-label={`Remove JD ${i + 1}`}
                  >
                    <Trash2 className="size-4 text-rose-600" />
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Paste the JD text"
                  value={j.text}
                  onChange={(event) => updateJd(j.id, "text", event.target.value)}
                />
              </div>
            ))}
            <Button
              type="button"
              className="w-full bg-teal-700 text-white hover:bg-teal-800"
              onClick={analyze}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
              Score against all JDs
            </Button>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      {result ? <Results response={result} /> : null}
    </div>
  );
}

function Results({ response }: { response: MultiJdResponse }) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Ranked results · resume {response.resumeWordCount} words</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {response.entries.map((e, rank) => {
          const isBest = rank === 0;
          const tone =
            e.matchPct >= 75
              ? "border-emerald-300 bg-emerald-50"
              : e.matchPct >= 50
                ? "border-amber-300 bg-amber-50"
                : "border-rose-300 bg-rose-50";
          return (
            <div key={e.index} className={`rounded-md border p-4 ${tone}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {isBest ? <Trophy className="size-4 text-amber-600" /> : null}
                    <span className="font-semibold text-neutral-900">
                      #{rank + 1}: {e.label}
                    </span>
                  </div>
                  {e.jdTitle ? (
                    <div className="text-xs text-neutral-700">
                      {e.jdTitle} · {e.industry ?? "—"} · {e.seniority}
                      {e.yearsRequired !== null ? ` · ${e.yearsRequired}+ years` : ""}
                    </div>
                  ) : null}
                  {e.error ? <p className="mt-1 text-xs text-rose-700">{e.error}</p> : null}
                </div>
                <div className="text-3xl font-semibold text-neutral-900">{e.matchPct}%</div>
              </div>

              {!e.error ? (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <KwBucket title="Matched (hard + tools)" items={[...e.matched.hard, ...e.matched.tools]} tone="good" />
                  <KwBucket title="Missing (top gaps)" items={[...e.missing.hard, ...e.missing.tools].slice(0, 12)} tone="bad" />
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function KwBucket({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  const cls = tone === "good" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900";
  return (
    <div>
      <div className="mb-1 font-medium text-neutral-700">{title}</div>
      {items.length === 0 ? (
        <Badge variant="outline" className="text-[10px]">—</Badge>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 15).map((k) => (
            <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
