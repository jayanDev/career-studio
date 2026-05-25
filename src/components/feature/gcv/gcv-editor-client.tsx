"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, ExternalLink, Eye, FileImage, Palette, Save } from "lucide-react";

import { GcvVisualPreview } from "@/components/feature/gcv/gcv-visual-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n-config";
import {
  analyzeGcvDesign,
  applyGcvModeToContent,
  defaultGcvTheme,
  gcvFontPairings,
  gcvPalettes,
  gcvTemplates,
  type GcvBlock,
  type GcvTheme,
} from "@/lib/gcv-design";
import { createId, type ResumeContent } from "@/lib/resume-content";
import { updateGcvResumeAction } from "@/server/actions/resumes/create-resume";

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
  const [theme, setTheme] = useState(defaultGcvTheme(initialTheme));
  const [resumeTitle, setResumeTitle] = useState(title);
  const [portfolioText, setPortfolioText] = useState(theme.portfolioEmbeds.join("\n"));
  const saveAction = updateGcvResumeAction.bind(null, locale, resumeId);
  const visualContent = useMemo(() => applyGcvModeToContent(content, { ...theme, portfolioEmbeds: portfolioText.split("\n").map((line) => line.trim()).filter(Boolean) }), [content, portfolioText, theme]);
  const design = useMemo(() => analyzeGcvDesign(visualContent, theme), [theme, visualContent]);

  function updateTheme(patch: Partial<GcvTheme>) {
    setTheme((current) => defaultGcvTheme({ ...current, ...patch }));
  }

  function selectTemplate(key: string) {
    const template = gcvTemplates.find((item) => item.key === key);
    updateTheme({
      template: key,
      layout: template?.layout ?? theme.layout,
      tone: template?.tone ?? theme.tone,
      showMotif: key.includes("sl-designer"),
      paper: key.includes("sl-") ? "A4" : theme.paper,
    });
  }

  function updateBlock(id: string, patch: Partial<GcvBlock>) {
    updateTheme({ blocks: theme.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const next = [...theme.blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateTheme({ blocks: next });
  }

  function syncLocalMode(nextMode: GcvTheme["mode"]) {
    updateTheme({
      mode: nextMode,
      showPhoto: nextMode === "visual" && theme.showPhoto,
      showLogos: nextMode === "visual" && theme.showLogos,
    });
  }

  const hydratedTheme = {
    ...theme,
    portfolioEmbeds: portfolioText.split("\n").map((line) => line.trim()).filter(Boolean),
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[26rem_minmax(0,1fr)_21rem]">
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="contentJson" value={JSON.stringify(visualContent)} />
        <input type="hidden" name="themeJson" value={JSON.stringify(hydratedTheme)} />
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{labels.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{labels.title}</Label>
              <Input id="title" name="title" value={resumeTitle} onChange={(event) => setResumeTitle(event.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mode">
                <select value={theme.mode} onChange={(event) => syncLocalMode(event.target.value as GcvTheme["mode"])} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="visual">Visual</option>
                  <option value="ats-safe">ATS-safe</option>
                </select>
              </Field>
              <Field label="Local / global">
                <select
                  value={theme.paper}
                  onChange={(event) => {
                    const paper = event.target.value as GcvTheme["paper"];
                    updateTheme({ paper, showPhoto: paper === "A4", showLogos: paper === "A4" });
                    setContent((current) => ({ ...current, mode: paper === "A4" ? "local" : "international" }));
                  }}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="A4">Local SL / A4</option>
                  <option value="Letter">International / Letter</option>
                </select>
              </Field>
            </div>

            <Field label={labels.template}>
              <div className="grid max-h-72 gap-2 overflow-auto pr-1">
                {gcvTemplates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => selectTemplate(template.key)}
                    className={`rounded-md border p-3 text-left text-sm transition ${theme.template === template.key ? "border-teal-700 bg-teal-50" : "hover:bg-neutral-50"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-neutral-950">{template.name}</span>
                      {template.premium ? <Badge variant="outline" className="rounded-md">Pro</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">{template.industry} | {template.layout} | {template.tone}</p>
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Palette">
                <select value={theme.palette} onChange={(event) => updateTheme({ palette: event.target.value, accent: event.target.value })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  {gcvPalettes.map((palette) => <option key={palette.key} value={palette.key}>{palette.name}</option>)}
                </select>
              </Field>
              <Field label="Fonts">
                <select value={theme.fontPairing} onChange={(event) => updateTheme({ fontPairing: event.target.value })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  {gcvFontPairings.map((font) => <option key={font.key} value={font.key}>{font.name}</option>)}
                </select>
              </Field>
              <Field label={labels.density}>
                <select value={theme.density} onChange={(event) => updateTheme({ density: event.target.value as GcvTheme["density"] })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
              </Field>
              <Field label="Layout">
                <select value={theme.layout} onChange={(event) => updateTheme({ layout: event.target.value as GcvTheme["layout"] })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="one-column">One column</option>
                  <option value="two-column">Two column</option>
                  <option value="sidebar-left">Sidebar left</option>
                  <option value="sidebar-right">Sidebar right</option>
                  <option value="canvas">Canvas-style</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Name">
              <Input value={content.header.fullName} onChange={(event) => setContent((current) => ({ ...current, header: { ...current.header, fullName: event.target.value } }))} />
            </Field>
            <Field label="Title">
              <Input value={content.header.title} onChange={(event) => setContent((current) => ({ ...current, header: { ...current.header, title: event.target.value } }))} />
            </Field>
            <Field label="Photo URL">
              <Input value={content.header.photoUrl} onChange={(event) => setContent((current) => ({ ...current, header: { ...current.header, photoUrl: event.target.value } }))} placeholder="https://..." />
            </Field>
            <Field label={labels.summary}>
              <Textarea rows={5} value={content.summary} onChange={(event) => setContent((current) => ({ ...current, summary: event.target.value }))} />
            </Field>
            <Field label={labels.skills}>
              <Textarea rows={4} value={content.skills.join("\n")} onChange={(event) => setContent((current) => ({ ...current, skills: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }))} />
            </Field>
            <Field label="Portfolio embeds">
              <Textarea rows={4} value={portfolioText} onChange={(event) => setPortfolioText(event.target.value)} placeholder="YouTube, Behance, Dribbble, GitHub, CodePen, portfolio links" />
            </Field>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Custom sections</CardTitle>
            <p className="text-xs text-neutral-500">Optional — leave any blank to hide.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Languages (one per line, format: Sinhala — Native)">
              <Textarea
                rows={3}
                value={content.languages.map((l) => `${l.name}${l.proficiency ? ` — ${l.proficiency}` : ""}`).join("\n")}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    languages: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [name = "", proficiency = ""] = line.split(/\s+—\s+|\s+-\s+/);
                        return { id: createId(), name: name.trim(), proficiency: proficiency.trim() };
                      }),
                  }))
                }
                placeholder="English — Native\nSinhala — Fluent\nTamil — Conversational"
              />
            </Field>
            <Field label="Awards (Name — Issuer — Year)">
              <Textarea
                rows={3}
                value={content.awards.map((a) => `${a.name}${a.issuer ? ` — ${a.issuer}` : ""}${a.date ? ` — ${a.date}` : ""}`).join("\n")}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    awards: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [name = "", issuer = "", date = ""] = line.split(/\s+—\s+|\s+-\s+/);
                        return { id: createId(), name: name.trim(), issuer: issuer.trim(), date: date.trim() };
                      }),
                  }))
                }
                placeholder="Dean's List — University of Moratuwa — 2023"
              />
            </Field>
            <Field label="Volunteering (Role — Organization — Start — End)">
              <Textarea
                rows={3}
                value={content.volunteering
                  .map((v) =>
                    [v.role, v.organization, v.startDate, v.endDate].filter(Boolean).join(" — "),
                  )
                  .join("\n")}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    volunteering: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [role = "", organization = "", startDate = "", endDate = ""] = line.split(/\s+—\s+|\s+-\s+/);
                        return {
                          id: createId(),
                          role: role.trim(),
                          organization: organization.trim(),
                          startDate: startDate.trim(),
                          endDate: endDate.trim(),
                          description: "",
                        };
                      }),
                  }))
                }
                placeholder="Tutor — Code.lk Bootcamp — 2022 — 2023"
              />
            </Field>
            <Field label="Publications (Title — Publisher — Date — URL)">
              <Textarea
                rows={3}
                value={content.publications
                  .map((p) => [p.title, p.publisher, p.date, p.url].filter(Boolean).join(" — "))
                  .join("\n")}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    publications: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [title = "", publisher = "", date = "", url = ""] = line.split(/\s+—\s+|\s+-\s+/);
                        return { id: createId(), title: title.trim(), publisher: publisher.trim(), date: date.trim(), url: url.trim() };
                      }),
                  }))
                }
                placeholder="Building scalable services in Sri Lanka — Medium — 2024 — https://..."
              />
            </Field>
            <Field label="References (Name — Title — Organization — Phone — Email)">
              <Textarea
                rows={3}
                value={content.references
                  .map((r) => [r.name, r.title, r.organization, r.phone, r.email].filter(Boolean).join(" — "))
                  .join("\n")}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    references: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [name = "", title = "", organization = "", phone = "", email = ""] = line.split(/\s+—\s+|\s+-\s+/);
                        return {
                          id: createId(),
                          name: name.trim(),
                          title: title.trim(),
                          organization: organization.trim(),
                          phone: phone.trim(),
                          email: email.trim(),
                          relationship: "",
                        };
                      }),
                  }))
                }
                placeholder="Mr Nuwan Perera — Engineering Manager — WSO2 — +94 77 123 4567 — nuwan@example.com"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Visual Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["showPhoto", "Photo"],
                ["showLogos", "SL logos"],
                ["showQr", "QR code"],
                ["showPortfolio", "Portfolio"],
                ["showMotif", "SL motif"],
                ["showBleed", "Bleed mark"],
                ["animated", "Animated web"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="checkbox" checked={Boolean(theme[key as keyof GcvTheme])} onChange={(event) => updateTheme({ [key]: event.target.checked } as Partial<GcvTheme>)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Photo shape">
                <select value={theme.photoShape} onChange={(event) => updateTheme({ photoShape: event.target.value as GcvTheme["photoShape"] })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="hexagon">Hexagon</option>
                </select>
              </Field>
              <Field label="Photo filter">
                <select value={theme.photoFilter} onChange={(event) => updateTheme({ photoFilter: event.target.value as GcvTheme["photoFilter"] })} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="none">None</option>
                  <option value="bw">B&W</option>
                  <option value="sepia">Sepia</option>
                  <option value="bright">Bright</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {theme.blocks.map((block, index) => (
              <div key={block.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={block.enabled} onChange={(event) => updateBlock(block.id, { enabled: event.target.checked })} />
                <div>
                  <div className="font-medium text-neutral-900">{block.label}</div>
                  <select value={block.region} onChange={(event) => updateBlock(block.id, { region: event.target.value as GcvBlock["region"] })} className="mt-1 h-7 rounded-md border bg-white px-2 text-xs">
                    <option value="header">Header</option>
                    <option value="main">Main</option>
                    <option value="sidebar">Sidebar</option>
                    <option value="footer">Footer</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon-xs" variant="outline" onClick={() => moveBlock(index, -1)}><ArrowUp className="size-3" /></Button>
                  <Button type="button" size="icon-xs" variant="outline" onClick={() => moveBlock(index, 1)}><ArrowDown className="size-3" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="flex flex-wrap gap-2 p-4">
            <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
              <Save className="size-4" />
              {labels.save}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Download className="size-4" />
              Print/PDF
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/api/gcv/${resumeId}/export/pdf`}>
                <Download className="size-4" />
                PDF
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/api/gcv/${resumeId}/export/svg`}>
                <FileImage className="size-4" />
                SVG
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/api/gcv/${resumeId}/export/png`}>
                <FileImage className="size-4" />
                PNG
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/g/${resumeId}`} target="_blank">
                <ExternalLink className="size-4" />
                Web
              </Link>
            </Button>
          </CardContent>
        </Card>
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-neutral-950">{labels.preview}</h2>
          <Badge variant="outline" className="rounded-md">{theme.mode}</Badge>
        </div>
        <GcvVisualPreview content={visualContent} theme={hydratedTheme} talentSlug={talentSlug} locale={locale} />
      </section>

      <aside className="space-y-4">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-4 text-teal-700" />
              Design Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Estimated ATS score</span>
                <span className="font-semibold">{design.atsScore}</span>
              </div>
              <Progress value={design.atsScore} className="h-2" />
            </div>
            <div className="rounded-md bg-neutral-50 p-3 text-sm">
              Estimated pages: <span className="font-semibold">{design.pageCountEstimate}</span>
            </div>
            {design.issues.map((issue) => (
              <p key={issue} className="rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">{issue}</p>
            ))}
            {design.suggestions.map((suggestion) => (
              <p key={suggestion} className="rounded-md bg-teal-50 p-2 text-xs leading-5 text-teal-900">{suggestion}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-teal-700" />
              Print & Share
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-600">
            <p>A4 is selected for Local SL mode; Letter is available for international applications.</p>
            <p>NIC is masked in ATS-safe exports and should remain hidden for web share links unless explicitly required.</p>
            <p>Portfolio links render as live links on the public web version and as visible URLs in exported SVG/PNG.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
