"use client";

import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, Gauge, Loader2, Trophy, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { interpretScore } from "@/lib/ats-scoring";
import {
  bulkScoreResumesAction,
  type BulkScoreResponse,
} from "@/server/actions/ats/bulk-score";

export function BulkClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState<BulkScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 5 * 1024 * 1024,
    onDrop: (accepted) =>
      setFiles((prev) => {
        const next = [...prev];
        for (const f of accepted) {
          if (!next.find((existing) => existing.name === f.name && existing.size === f.size)) {
            next.push(f);
          }
        }
        return next.slice(0, 25);
      }),
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function analyse() {
    setError(null);
    if (files.length === 0) {
      setError("Add at least one CV.");
      return;
    }
    if (!jd.trim()) {
      setError("Paste a job description.");
      return;
    }
    const formData = new FormData();
    formData.set("jobDescription", jd);
    files.forEach((f) => formData.append("resumeFiles", f));
    startTransition(async () => {
      try {
        setResult(await bulkScoreResumesAction(formData));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk scoring failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Job description</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={12}
              placeholder="Paste the JD. This is what every CV is scored against."
              value={jd}
              onChange={(event) => setJd(event.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>CVs ({files.length}/25)</CardTitle>
            <Button type="button" onClick={analyse} disabled={isPending} className="bg-teal-700 text-white hover:bg-teal-800">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
              Score all
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              {...getRootProps()}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${isDragActive ? "border-teal-500 bg-teal-50" : "border-neutral-200 bg-neutral-50"}`}
            >
              <input {...getInputProps()} />
              <FileUp className="size-8 text-teal-700" />
              <p className="mt-2 text-sm font-medium text-neutral-950">
                {isDragActive ? "Drop the CVs here" : "Drop up to 25 CVs"}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">PDF, DOC, DOCX, TXT · 5MB each</p>
            </div>

            {files.length > 0 ? (
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border bg-neutral-50 p-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs">
                    <span className="truncate text-neutral-800">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-rose-600 hover:text-rose-800"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      {result ? <BulkResults response={result} /> : null}
    </div>
  );
}

function BulkResults({ response }: { response: BulkScoreResponse }) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>
          Ranked CVs — {response.jd.title} · {response.jd.industry}
        </CardTitle>
        <p className="text-xs text-neutral-500">
          {response.succeeded} scored · {response.failed} failed ·{" "}
          {response.jd.yearsRequired !== null ? `${response.jd.yearsRequired}+ years required` : "years unspecified"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 w-10">#</th>
                <th>CV</th>
                <th className="text-right">Overall</th>
                <th>Band</th>
                <th className="text-right">JD match</th>
                <th>Top matched skills</th>
                <th>Top gaps</th>
              </tr>
            </thead>
            <tbody>
              {response.entries.map((e, rank) => {
                if (e.error) {
                  return (
                    <tr key={`err-${rank}-${e.filename}`} className="border-b last:border-b-0 text-rose-700">
                      <td className="py-2">—</td>
                      <td className="font-medium">{e.filename}</td>
                      <td colSpan={5} className="text-xs italic">{e.error}</td>
                    </tr>
                  );
                }
                const interp = interpretScore(e.overall);
                const bandClass =
                  interp.band === "excellent"
                    ? "bg-emerald-600"
                    : interp.band === "good"
                      ? "bg-teal-700"
                      : interp.band === "fair"
                        ? "bg-amber-600"
                        : "bg-rose-600";
                return (
                  <tr key={`${e.filename}-${rank}`} className="border-b last:border-b-0">
                    <td className="py-2">
                      {rank === 0 ? (
                        <Trophy className="size-4 text-amber-600" />
                      ) : (
                        <span className="text-neutral-500">{rank + 1}</span>
                      )}
                    </td>
                    <td className="font-medium text-neutral-900">
                      {e.filename}
                      {e.warning ? <span className="block text-[10px] text-amber-700">⚠ {e.warning}</span> : null}
                    </td>
                    <td className="text-right font-semibold">{e.overall}</td>
                    <td>
                      <Badge className={`${bandClass} text-white text-[10px]`}>{interp.label}</Badge>
                    </td>
                    <td className="text-right text-neutral-700">{e.jdMatchPct}%</td>
                    <td className="max-w-xs">
                      {e.matchedHardSkills.length === 0 ? (
                        <span className="text-xs text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.matchedHardSkills.slice(0, 6).map((s) => (
                            <span key={s} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="max-w-xs">
                      {e.missingHardSkills.length === 0 ? (
                        <span className="text-xs text-emerald-600">Full coverage</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.missingHardSkills.slice(0, 6).map((s) => (
                            <span key={s} className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-900">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
