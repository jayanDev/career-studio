"use client";

/**
 * Resume template gallery (P1-9 from the CV Builder roadmap).
 *
 * Replaces the static 6-template grid with a 60-template (20 roles × 3
 * tiers) browsable gallery. CSS-based thumbnails vary by tier:
 *   - basic    one-column minimalist
 *   - pro      two-column sidebar
 *   - premium  designer header band + content blocks
 *
 * Filters: tier (all / basic / pro / premium) and free-text role
 * search. Selection drives a hidden `templateKey` input the parent
 * form submits.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resumeRoleTemplates, type ResumeRoleTemplate } from "@/lib/resume-templates";

type Tier = "all" | "basic" | "pro" | "premium";

export function ResumeTemplateGallery({
  inputName = "templateKey",
  defaultSelected = "software-engineer-basic",
}: {
  inputName?: string;
  defaultSelected?: string;
}) {
  const [tier, setTier] = useState<Tier>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(defaultSelected);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resumeRoleTemplates.filter((tpl) => {
      if (tier !== "all" && tpl.category !== tier) return false;
      if (q && !tpl.roleName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tier, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs font-semibold uppercase text-neutral-600">Select Template</Label>
        <div className="flex items-center gap-1 rounded-md border bg-white p-1">
          {(["all", "basic", "pro", "premium"] as Tier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition ${
                tier === t ? "bg-teal-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search role"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Showing {filtered.length} of {resumeRoleTemplates.length} templates.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((template) => (
          <TemplateCard
            key={template.templateKey}
            template={template}
            selected={selected === template.templateKey}
            onSelect={() => setSelected(template.templateKey)}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="col-span-full rounded-md border bg-neutral-50 p-6 text-center text-sm text-neutral-600">
            No templates match those filters.
          </p>
        ) : null}
      </div>

      <input type="hidden" name={inputName} value={selected} required />
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ResumeRoleTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="group block text-left">
      <div
        className={`overflow-hidden rounded-xl border-2 bg-white p-2 transition-all ${
          selected
            ? "border-teal-600 ring-4 ring-teal-600/10"
            : "border-neutral-200 hover:border-teal-300"
        }`}
      >
        <div className="aspect-[3/4] overflow-hidden rounded bg-neutral-50">
          {template.category === "basic" ? <BasicThumbnail /> : null}
          {template.category === "pro" ? <ProThumbnail /> : null}
          {template.category === "premium" ? <PremiumThumbnail /> : null}
        </div>
        <div className="mt-2 px-1">
          <div className="truncate text-xs font-semibold text-neutral-900">{template.roleName}</div>
          <div className="mt-0.5 flex items-center justify-between">
            <Badge
              variant="outline"
              className={`text-[9px] capitalize ${
                template.category === "premium"
                  ? "border-amber-300 text-amber-800"
                  : template.category === "pro"
                    ? "border-teal-300 text-teal-800"
                    : "border-neutral-300 text-neutral-700"
              }`}
            >
              {template.category}
            </Badge>
            <span className="text-[9px] uppercase tracking-wide text-neutral-400">ATS-safe</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function BasicThumbnail() {
  return (
    <div className="flex h-full flex-col gap-1.5 p-2 text-neutral-300">
      <div className="h-2 w-1/2 rounded-full bg-neutral-300" />
      <div className="h-1 w-1/3 rounded-full bg-neutral-200" />
      <div className="my-1 h-px w-full bg-neutral-200" />
      <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
      <div className="h-1 w-3/4 rounded-full bg-neutral-200" />
      <div className="h-1 w-1/2 rounded-full bg-neutral-200" />
      <div className="my-1 h-px w-full bg-neutral-200" />
      <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
      <div className="h-1 w-1/2 rounded-full bg-neutral-200" />
    </div>
  );
}

function ProThumbnail() {
  return (
    <div className="flex h-full gap-1 p-2 text-teal-200">
      <div className="flex w-1/3 flex-col gap-1 rounded bg-teal-50 p-1.5">
        <div className="size-5 rounded-full bg-teal-200" />
        <div className="h-1 w-3/4 rounded-full bg-teal-200" />
        <div className="h-1 w-1/2 rounded-full bg-teal-200" />
        <div className="mt-1 h-px w-full bg-teal-100" />
        <div className="h-1 w-2/3 rounded-full bg-teal-200" />
        <div className="h-1 w-3/4 rounded-full bg-teal-200" />
        <div className="h-1 w-1/2 rounded-full bg-teal-200" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1">
        <div className="h-2 w-1/2 rounded-full bg-teal-700" />
        <div className="h-1 w-1/3 rounded-full bg-teal-300" />
        <div className="my-1 h-px w-full bg-neutral-200" />
        <div className="h-1 w-3/4 rounded-full bg-neutral-200" />
        <div className="h-1 w-1/2 rounded-full bg-neutral-200" />
        <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
        <div className="my-1 h-px w-full bg-neutral-200" />
        <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

function PremiumThumbnail() {
  return (
    <div className="flex h-full flex-col text-amber-200">
      <div className="flex h-8 items-center gap-2 bg-gradient-to-r from-amber-700 to-amber-900 px-2">
        <div className="h-1.5 w-1/3 rounded-full bg-amber-100" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="h-1 w-1/3 rounded-full bg-amber-300" />
        <div className="h-1 w-1/4 rounded-full bg-amber-200" />
        <div className="my-1 h-px w-full bg-neutral-200" />
        <div className="grid grid-cols-2 gap-1">
          <div className="h-1 rounded-full bg-neutral-200" />
          <div className="h-1 rounded-full bg-neutral-200" />
        </div>
        <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
        <div className="h-1 w-3/4 rounded-full bg-neutral-200" />
        <div className="my-1 h-px w-full bg-neutral-200" />
        <div className="h-1 w-1/2 rounded-full bg-neutral-200" />
        <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}
