"use client";

/**
 * Career GPS refinement card.
 *
 * Lets the user iterate on a generated plan without going back to the
 * form. Two patterns share the same primitive (refineCareerPlanAction):
 *   - Preset chips for the common asks ("Show more stretch options",
 *     "I can't relocate", "What if I do an MBA?")
 *   - Free-text input for arbitrary what-ifs.
 *
 * On submit the existing plan is replaced in place; the page refreshes
 * via router.refresh() so every panel re-renders against the new data.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  refineCareerPlanAction,
  type RefinementKind,
} from "@/server/actions/career-gps/refine-plan";

type Preset = {
  label: string;
  kind: RefinementKind;
  prompt: string;
};

const PRESETS: Preset[] = [
  { label: "Show me different stretch options", kind: "more_options", prompt: "Show me different stretch pathways — I want to see options I haven't considered." },
  { label: "I don't want to relocate", kind: "constraint", prompt: "I will not relocate. Keep me in my current city. Re-plan around that." },
  { label: "I'm willing to relocate abroad", kind: "constraint", prompt: "I'm open to relocating outside Sri Lanka. Surface global pathways." },
  { label: "Make the plan more aggressive", kind: "constraint", prompt: "Compress timelines. Assume I can put 15+ hours/week into this." },
  { label: "Make the plan more conservative", kind: "constraint", prompt: "Stretch timelines. Assume I have 3-4 hours/week and existing job obligations." },
  { label: "What if I learn Python this year?", kind: "what_if", prompt: "What if I become fluent in Python over the next 12 months?" },
  { label: "What if I do an MBA?", kind: "what_if", prompt: "What if I complete an MBA over the next 2 years?" },
];

export function RefinementCard({ planId }: { planId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<RefinementKind>("what_if");
  const [error, setError] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [method, setMethod] = useState<"ai" | "fallback" | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(prompt: string, refinementKind: RefinementKind) {
    if (!prompt.trim()) {
      setError("Type a what-if or pick a preset.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await refineCareerPlanAction({
          planId,
          refinement: prompt,
          kind: refinementKind,
        });
        setLastApplied(response.appliedRefinement);
        setMethod(response.method);
        setText("");
        // Force a server-component refresh so every panel (constellation,
        // pathways, roadmap) renders against the new plan.
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refinement failed");
      }
    });
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-4 text-teal-700" />
          Refine your plan
        </CardTitle>
        <p className="text-xs text-neutral-500">
          Try a what-if or push the plan in a new direction. The whole roadmap will update — your previous version is overwritten.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => submit(preset.prompt, preset.kind)}
              disabled={isPending}
              className="rounded-full border bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as RefinementKind)}
              className="h-9 rounded-md border bg-white px-2 text-xs"
              disabled={isPending}
            >
              <option value="what_if">What-if</option>
              <option value="more_options">Different options</option>
              <option value="drop_pathway">Drop a pathway</option>
              <option value="constraint">New constraint</option>
            </select>
            <Textarea
              rows={2}
              placeholder="e.g. 'What if I move to Galle for a year?'"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={isPending}
              className="flex-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-neutral-500">Refinements run on Gemini; the previous plan is overwritten.</p>
            <Button
              type="button"
              size="sm"
              onClick={() => submit(text, kind)}
              disabled={isPending || !text.trim()}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
              Apply refinement
            </Button>
          </div>
        </div>

        {error ? <p className="text-xs text-rose-700">{error}</p> : null}

        {lastApplied ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-3.5" />
              Applied — plan refreshed
              {method ? (
                <Badge variant="outline" className="text-[10px]">
                  {method === "ai" ? "Gemini" : "Fallback (no API key)"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1">&ldquo;{lastApplied}&rdquo;</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
