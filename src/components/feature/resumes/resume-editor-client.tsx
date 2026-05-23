"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, BookOpen, CheckCircle2, FileSearch, Globe, GripVertical, MapPin, Plus, Share2, Sparkles, Trash2, Undo2, Wand2 } from "lucide-react";

import { ResumePreview } from "@/components/feature/resumes/resume-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createId, resumeSectionKeys, type ResumeContent, type ResumeSectionKey } from "@/lib/resume-content";
import { slCertifications, slEducationTypes, slUniversities, slCompanies, slDistricts } from "@/lib/sl-data";
import { checkResumeGrammarAction, generateResumeSectionAction, getLiveAtsScoreAction, improveResumeTextAction, saveResumeContentAction, tailorResumeToJobAction } from "@/server/actions/resumes/create-resume";

type ResumeEditorLabels = {
  saveIdle: string;
  saving: string;
  saved: string;
  improve: string;
  add: string;
  remove: string;
  livePreview: string;
  sections: Record<string, string>;
};

const bulletLibrary = [
  "Improved reporting accuracy by standardising weekly dashboards and resolving data quality issues before leadership review.",
  "Coordinated cross-functional stakeholders to deliver priority work on schedule while keeping risks visible.",
  "Reduced manual follow-up by documenting repeatable workflows and introducing clearer handoff checkpoints.",
  "Analysed customer or operational trends to identify process gaps and recommend measurable improvements.",
  "Delivered client-facing updates with clear timelines, next steps, and issue ownership.",
  "Built reusable templates that shortened turnaround time and improved consistency across deliverables.",
  "Supported onboarding and knowledge sharing by creating practical guides for recurring tasks.",
  "Managed competing priorities across daily operations while maintaining service quality and response times.",
];

type BulletToolState = Record<string, { original: string; options: string[] }>;

export function ResumeEditorClient({
  resumeId,
  initialContent,
  labels,
}: {
  resumeId: string;
  initialContent: ResumeContent;
  labels: ResumeEditorLabels;
}) {
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState(labels.saveIdle);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Bullet AI state
  const [improvingBullet, setImprovingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [bulletTools, setBulletTools] = useState<BulletToolState>({});
  const [libraryFor, setLibraryFor] = useState<number | null>(null);
  const [jdText, setJdText] = useState("");
  const [tailorNote, setTailorNote] = useState("");
  const [grammarIssues, setGrammarIssues] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const [atsScore, setAtsScore] = useState<any>(null);

  useEffect(() => {
    setSaveState(labels.saving);
    setSaveError(null);
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          await saveResumeContentAction(resumeId, content);
          const score = await getLiveAtsScoreAction(content);
          setAtsScore(score);
          setSaveState(labels.saved);
          setLastSaved(new Date());
          setSaveError(null);
        } catch {
          setSaveState("Offline - changes pending");
          setSaveError("Autosave will retry after your next edit.");
        }
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [content, labels.saved, labels.saving, resumeId]);

  // Checklist computation
  const checklist = useMemo(() => {
    const contactDone = !!(content.header.fullName && content.header.email && content.header.phone && content.header.location);
    const summaryDone = content.summary.trim().length > 50;
    const expDone = content.experience.length > 0 && content.experience.some(e => e.title && e.bullets.filter(b => b.trim().length > 10).length >= 3);
    const eduDone = content.education.length > 0 && !!content.education[0].institution;
    const skillsDone = content.skills.length >= 6;
    
    const steps = [
      { name: "Contact Details", done: contactDone, required: true },
      { name: "Summary (2-4 sentences)", done: summaryDone, required: true },
      { name: "Experience (≥3 bullets)", done: expDone, required: true },
      { name: "Education", done: eduDone, required: true },
      { name: "Skills (≥6 skills)", done: skillsDone, required: false },
    ];
    
    const requiredDone = steps.filter(s => s.required && s.done).length;
    const requiredTotal = steps.filter(s => s.required).length;
    const percent = Math.round((requiredDone / requiredTotal) * 100);
    
    return { steps, percent };
  }, [content]);

  const orderedSections = useMemo(
    () => content.sectionOrder.filter((section): section is ResumeSectionKey => resumeSectionKeys.includes(section)),
    [content.sectionOrder]
  );

  function setHeaderField(field: keyof ResumeContent["header"], value: string) {
    setContent((current) => ({ ...current, header: { ...current.header, [field]: value } }));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSections.indexOf(active.id as ResumeSectionKey);
    const newIndex = orderedSections.indexOf(over.id as ResumeSectionKey);
    setContent((current) => ({ ...current, sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) }));
  }

  async function improveSummary() {
    const result = await improveResumeTextAction({ text: content.summary || content.header.title || "Professional summary", type: "summary" });
    setSuggestions(result);
  }

  async function handleImproveBullet(expIdx: number, bulletIdx: number, text: string) {
    if (!text || text.length < 5) return;
    setImprovingBullet({ expIdx, bulletIdx });
    try {
      const result = await improveResumeTextAction({ text, type: "bullet" });
      if (result && result.length > 0) {
        const key = `${expIdx}:${bulletIdx}`;
        setBulletTools((current) => ({ ...current, [key]: { original: text, options: result } }));
        setContent((current) => {
          const newExp = [...current.experience];
          const newBullets = [...newExp[expIdx].bullets];
          newBullets[bulletIdx] = result[0]; // Auto-replace with best option
          newExp[expIdx] = { ...newExp[expIdx], bullets: newBullets };
          return { ...current, experience: newExp };
        });
      }
    } finally {
      setImprovingBullet(null);
    }
  }

  function addSection(key: ResumeSectionKey) {
    if (!orderedSections.includes(key)) {
      setContent(cur => ({ ...cur, sectionOrder: [...cur.sectionOrder, key] }));
    }
  }

  function applyResumeMode(mode: ResumeContent["mode"]) {
    setContent((current) => {
      const baseOrder = current.sectionOrder.filter((section) => resumeSectionKeys.includes(section));
      const localOrder = Array.from(new Set([...baseOrder, "languages", "references"] as ResumeSectionKey[]));
      return {
        ...current,
        mode,
        header: {
          ...current.header,
          nic: mode === "international" ? "" : current.header.nic,
          expectedSalary: mode === "international" ? "" : current.header.expectedSalary,
        },
        sectionOrder: mode === "local" ? localOrder : baseOrder.filter((section) => section !== "references"),
        settings: {
          ...current.settings,
          includePhoto: mode === "local",
          hideReferences: mode === "international",
          dateFormat: mode === "local" ? "numeric" : "month-year",
          exportFormat: mode === "international" ? "ats-friendly" : current.settings?.exportFormat ?? "pixel-perfect",
          resumeModeNote:
            mode === "local"
              ? "Local SL mode enables photo, referees, NIC, expected salary, and two-page-friendly defaults."
              : "International mode hides photo, NIC, salary, and references for ATS-friendly applications.",
        },
      };
    });
  }

  async function generateSection(type: "summary" | "skills" | "achievements") {
    setAiBusy(type);
    try {
      const result = await generateResumeSectionAction({ content, type });
      if (type === "skills") {
        setContent((current) => ({ ...current, skills: result.skills.length ? result.skills : current.skills }));
      } else if (type === "summary") {
        setContent((current) => ({ ...current, summary: result.text }));
      } else {
        setSuggestions(result.text.split("\n").filter(Boolean));
      }
    } finally {
      setAiBusy(null);
    }
  }

  async function tailorToJob() {
    if (jdText.trim().length < 20) return;
    setAiBusy("tailor");
    try {
      const result = await tailorResumeToJobAction({ content, jobDescription: jdText });
      setContent(result.content);
      setTailorNote(`Tailored with ${result.addedSkills.length} keyword skills added. JD match estimate: ${result.jdKeywordMatchPct}%.`);
    } finally {
      setAiBusy(null);
    }
  }

  async function runGrammarCheck() {
    setAiBusy("grammar");
    try {
      const result = await checkResumeGrammarAction(content);
      setGrammarIssues(result.issues);
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
      {content.mode === "local" && (
        <>
          <datalist id="sl-universities">
            {slUniversities.map(u => <option key={u} value={u} />)}
          </datalist>
          <datalist id="sl-companies">
            {slCompanies.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="sl-districts">
            {slDistricts.map(d => <option key={d} value={d} />)}
          </datalist>
          <datalist id="sl-certifications">
            {slCertifications.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="sl-education-types">
            {slEducationTypes.map(type => <option key={type} value={type} />)}
          </datalist>
        </>
      )}

      <div className="space-y-4">
        {/* Top toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-white px-4 py-3 gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={content.mode === "local" ? "default" : "outline"}
              size="sm"
              onClick={() => applyResumeMode("local")}
              className={content.mode === "local" ? "bg-teal-700 hover:bg-teal-800" : ""}
            >
              <MapPin className="size-4 mr-1.5" />
              Local SL
            </Button>
            <Button
              variant={content.mode === "international" ? "default" : "outline"}
              size="sm"
              onClick={() => applyResumeMode("international")}
              className={content.mode === "international" ? "bg-teal-700 hover:bg-teal-800" : ""}
            >
              <Globe className="size-4 mr-1.5" />
              International
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
              {isPending ? (
                <>
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  {labels.saving}
                </>
              ) : saveError ? (
                <>
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  <span title={saveError}>{saveState}</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="size-3.5 text-teal-600" />
                  Saved at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </>
              ) : (
                saveState
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm">
          <h3 className="font-semibold text-sm">Professional Summary</h3>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => generateSection("summary")} disabled={aiBusy === "summary"}>
              <Wand2 className="size-4 mr-1.5 text-teal-700" />
              Generate
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => generateSection("skills")} disabled={aiBusy === "skills"}>
              Skills
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => generateSection("achievements")} disabled={aiBusy === "achievements"}>
              Achievements
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={improveSummary}>
              <Sparkles className="size-4 mr-1.5 text-amber-500" />
              {labels.improve}
            </Button>
          </div>
        </div>

        {content.settings?.resumeModeNote ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900">
            {content.settings.resumeModeNote}
          </div>
        ) : null}

        <Card className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-md flex items-center gap-2">
              <FileSearch className="size-4 text-teal-700" />
              JD Tailoring
            </CardTitle>
            <CardDescription className="text-xs">Paste a job description to reorder bullets and surface relevant skills.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} value={jdText} onChange={(event) => setJdText(event.target.value)} placeholder="Paste the job description here..." />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={tailorToJob} disabled={aiBusy === "tailor" || jdText.trim().length < 20}>
                <Sparkles className="size-4 mr-1.5 text-amber-500" />
                Tailor resume
              </Button>
              {tailorNote ? <span className="text-xs font-medium text-teal-700">{tailorNote}</span> : null}
            </div>
          </CardContent>
        </Card>

        {suggestions.length ? (
          <Card className="bg-amber-50">
            <CardContent className="space-y-2 p-4">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="block w-full rounded-md border bg-white p-3 text-left text-sm leading-6 hover:bg-neutral-50"
                  onClick={() => setContent((current) => ({ ...current, summary: suggestion }))}
                >
                  {suggestion}
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {orderedSections.map((section) => (
                <SortableSection key={section} id={section} title={labels.sections[section] || section.toUpperCase()}>
                  {renderEditor(section, content, setContent, setHeaderField, labels, handleImproveBullet, improvingBullet, bulletTools, setBulletTools, libraryFor, setLibraryFor)}
                </SortableSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="pt-2 flex flex-wrap gap-2">
          {resumeSectionKeys.filter(k => !orderedSections.includes(k)).map(missingKey => (
            <Button key={missingKey} variant="outline" size="sm" onClick={() => addSection(missingKey)}>
              <Plus className="size-3.5 mr-1" />
              Add {labels.sections[missingKey] || missingKey}
            </Button>
          ))}
        </div>

        {/* Document Settings */}
        <Card className="bg-white mt-6 border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-md">Document Settings & Export</CardTitle>
            <CardDescription className="text-xs">Customize styling and configure PDF export options</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
               <div>
                  <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Font Family</Label>
                 <select 
                     className="mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950"
                     value={content.settings?.font || "inter"}
                     onChange={(e) => setContent(c => ({ ...c, settings: { ...c.settings, font: e.target.value as any } }))}
                  >
                     <option value="inter">Inter (Modern Sans)</option>
                     <option value="roboto">Roboto (Clean Sans)</option>
                     <option value="merriweather">Merriweather (Classic Serif)</option>
                     <option value="noto-sinhala">Noto Sans Sinhala</option>
                     <option value="noto-tamil">Noto Sans Tamil</option>
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Language</Label>
                   <select
                     className="mt-1.5 flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
                     value={content.settings?.displayLanguage || "en"}
                     onChange={(e) => setContent(c => ({ ...c, settings: { ...c.settings, displayLanguage: e.target.value as "en" | "si" | "ta" } }))}
                   >
                     <option value="en">English</option>
                     <option value="si">Sinhala</option>
                     <option value="ta">Tamil</option>
                   </select>
                 </div>
                 <div>
                   <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Dates</Label>
                   <select
                     className="mt-1.5 flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
                     value={content.settings?.dateFormat || "month-year"}
                     onChange={(e) => setContent(c => ({ ...c, settings: { ...c.settings, dateFormat: e.target.value as "month-year" | "numeric" } }))}
                   >
                     <option value="month-year">Mar 2024 - Present</option>
                     <option value="numeric">2024/03 - Present</option>
                   </select>
                 </div>
               </div>
               <div>
                  <Label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Accent Color</Label>
                  <div className="mt-2 flex gap-2">
                     {[
                        "#0f766e", // Teal
                        "#1d4ed8", // Blue
                        "#b91c1c", // Red
                        "#4338ca", // Indigo
                        "#334155", // Slate
                     ].map(color => (
                        <button
                           key={color}
                           type="button"
                           onClick={() => setContent(c => ({ ...c, settings: { ...c.settings, accentColor: color } }))}
                           className={`size-6 rounded-full border-2 focus:outline-none ring-offset-2 ${content.settings?.accentColor === color ? 'ring-2 ring-slate-400 border-white' : 'border-transparent'}`}
                           style={{ backgroundColor: color }}
                           title={color}
                        />
                     ))}
                  </div>
               </div>
            </div>
            
            <div className="space-y-4">
               <div className="flex items-center justify-between space-x-2">
                 <Label className="flex flex-col gap-1 cursor-pointer" htmlFor="export-format">
                   <span className="text-sm font-medium leading-none">ATS-Friendly PDF</span>
                   <span className="text-xs text-slate-500">Strips columns & graphics for parsers</span>
                 </Label>
                 <Switch 
                   id="export-format" 
                   checked={content.settings?.exportFormat === "ats-friendly"}
                   onCheckedChange={(checked) => setContent(c => ({ ...c, settings: { ...c.settings, exportFormat: checked ? "ats-friendly" : "pixel-perfect" } }))}
                 />
               </div>
               <div className="flex items-center justify-between space-x-2">
                 <Label className="flex flex-col gap-1 cursor-pointer" htmlFor="hide-refs">
                   <span className="text-sm font-medium leading-none">Hide References</span>
                   <span className="text-xs text-slate-500">Remove 'Available upon request'</span>
                 </Label>
                 <Switch 
                   id="hide-refs" 
                   checked={content.settings?.hideReferences}
                   onCheckedChange={(checked) => setContent(c => ({ ...c, settings: { ...c.settings, hideReferences: checked } }))}
                 />
               </div>
               <div className="flex items-center justify-between space-x-2">
                 <Label className="flex flex-col gap-1 cursor-pointer" htmlFor="include-photo">
                   <span className="text-sm font-medium leading-none">Photo in visual templates</span>
                   <span className="text-xs text-slate-500">Recommended only for local SL resumes</span>
                 </Label>
                 <Switch
                   id="include-photo"
                   checked={content.settings?.includePhoto}
                   onCheckedChange={(checked) => setContent(c => ({ ...c, settings: { ...c.settings, includePhoto: checked } }))}
                 />
               </div>
               <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                 <Label className="flex items-center gap-1.5 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                   <Share2 className="size-3.5" />
                   Shareable Web Resume
                 </Label>
                 <select
                   className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                   value={content.settings?.publicAccess || "private"}
                   onChange={(e) => setContent(c => ({ ...c, settings: { ...c.settings, publicAccess: e.target.value as "private" | "public" | "password" } }))}
                 >
                   <option value="private">Private</option>
                   <option value="public">Public link</option>
                   <option value="password">Password protected</option>
                 </select>
                 {content.settings?.publicAccess === "password" ? (
                   <Input
                     value={content.settings?.publicPassword || ""}
                     placeholder="Password"
                     onChange={(e) => setContent(c => ({ ...c, settings: { ...c.settings, publicPassword: e.target.value } }))}
                   />
                 ) : null}
                 {content.settings?.publicAccess !== "private" ? (
                   <p className="text-xs text-slate-500">Public URL: /r/{resumeId}</p>
                 ) : null}
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start space-y-6">
        <Card className="bg-white shadow-sm border-slate-200">
           <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-md flex items-center justify-between">
                 <span>ATS Readiness</span>
                 {atsScore && <span className="text-2xl font-bold text-teal-700">{atsScore.overall}<span className="text-xs text-neutral-400 font-normal">/100</span></span>}
              </CardTitle>
           </CardHeader>
           <CardContent className="space-y-5 pt-4">
              <div className="space-y-2.5">
                 <div className="flex justify-between text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <span>Completion</span>
                    <span className={checklist.percent === 100 ? "text-teal-600" : ""}>{checklist.percent}%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${checklist.percent}%` }} />
                 </div>
                 <div className="pt-2 grid gap-2">
                    {checklist.steps.map(s => (
                       <div key={s.name} className="flex items-center gap-2.5 text-xs">
                          {s.done ? <CheckCircle2 className="size-4 text-teal-600 shrink-0" /> : <div className="size-4 rounded-full border-2 border-slate-200 shrink-0" />}
                          <span className={s.done ? "text-slate-500 line-through" : "text-slate-800 font-medium"}>{s.name}</span>
                          {!s.required && <span className="text-[9px] uppercase tracking-wider text-slate-400 ml-auto">Optional</span>}
                       </div>
                    ))}
                 </div>
              </div>

              {atsScore && (
                 <div className="pt-4 border-t space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sub-Scores</h4>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-slate-50 p-2.5 rounded-lg border text-center">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Impact</div>
                          <div className="font-bold text-lg text-slate-700">{atsScore.breakdown.content.score}<span className="text-xs font-normal text-slate-400">/{atsScore.breakdown.content.max}</span></div>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-lg border text-center">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Format</div>
                          <div className="font-bold text-lg text-slate-700">{atsScore.breakdown.format.score}<span className="text-xs font-normal text-slate-400">/{atsScore.breakdown.format.max}</span></div>
                       </div>
                    </div>
                 </div>
              )}
              {atsScore?.issues?.length ? (
                 <div className="pt-4 border-t space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why this score?</h4>
                    {atsScore.issues.slice(0, 3).map((issue: string) => (
                       <div key={issue} className="flex gap-2 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{issue}</span>
                       </div>
                    ))}
                 </div>
              ) : null}
           </CardContent>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-950">{labels.livePreview}</h2>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100" onClick={runGrammarCheck} disabled={aiBusy === "grammar"}>
               <Sparkles className="size-3.5" />
               Grammar Check
            </Button>
          </div>
          {grammarIssues.length ? (
            <div className="mb-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              {grammarIssues.map((issue) => (
                <div key={issue} className="text-xs font-medium leading-5 text-amber-900">{issue}</div>
              ))}
            </div>
          ) : null}
          <ResumePreview content={content} />
        </div>
      </div>
    </div>
  );
}

function SortableSection({ id, title, children }: { id: ResumeSectionKey; title: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <Card ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="bg-white">
      <CardHeader className="flex-row items-center gap-3">
        <button type="button" className="text-neutral-400" {...attributes} {...listeners}>
          <GripVertical className="size-5" />
        </button>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function renderEditor(
  section: ResumeSectionKey,
  content: ResumeContent,
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>,
  setHeaderField: (field: keyof ResumeContent["header"], value: string) => void,
  labels: ResumeEditorLabels,
  handleImproveBullet: (expIdx: number, bulletIdx: number, text: string) => void,
  improvingBullet: { expIdx: number; bulletIdx: number } | null,
  bulletTools: BulletToolState,
  setBulletTools: React.Dispatch<React.SetStateAction<BulletToolState>>,
  libraryFor: number | null,
  setLibraryFor: React.Dispatch<React.SetStateAction<number | null>>
) {
  if (section === "header") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {([
          "fullName",
          "title",
          "email",
          "phone",
          "location",
          "linkedin",
          "website",
          ...(content.mode === "local" ? (["nic", "street", "district", "postalCode", "expectedSalary"] as const) : []),
        ] as const).map((field) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field} className="capitalize">{field}</Label>
            <Input 
              id={field} 
              value={content.header[field]} 
              onChange={(event) => setHeaderField(field, event.target.value)} 
              list={content.mode === "local" && (field === "location" || field === "district") ? "sl-districts" : undefined}
            />
          </div>
        ))}
        {content.mode === "local" ? (
          <div className="space-y-2">
            <Label htmlFor="salaryPeriod">Salary period</Label>
            <select
              id="salaryPeriod"
              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm"
              value={content.header.salaryPeriod}
              onChange={(event) => setContent((current) => ({ ...current, header: { ...current.header, salaryPeriod: event.target.value as "monthly" | "annual" } }))}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "summary") {
    return <Textarea rows={5} value={content.summary} onChange={(event) => setContent((current) => ({ ...current, summary: event.target.value }))} />;
  }

  if (section === "skills") {
    return (
      <div className="space-y-3">
        <Textarea
          rows={4}
          value={content.skills.join("\n")}
          onChange={(event) => {
            const skills = event.target.value.split("\n").map((line) => line.trim()).filter(Boolean);
            setContent((current) => ({
              ...current,
              skills,
              skillRatings: current.skillRatings.filter((item) => skills.includes(item.name)),
            }));
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setContent((current) => ({ ...current, settings: { ...current.settings, showSkillRatings: !current.settings?.showSkillRatings } }))}
          >
            {content.settings?.showSkillRatings ? "Hide ratings" : "Add rating bars"}
          </Button>
          {content.skills.map((skill) => {
            const currentRating = content.skillRatings.find((item) => item.name === skill)?.rating ?? 3;
            return content.settings?.showSkillRatings ? (
              <label key={skill} className="flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-xs">
                <span className="max-w-28 truncate">{skill}</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={currentRating}
                  onChange={(event) => {
                    const rating = Number(event.target.value);
                    setContent((current) => {
                      const existing = current.skillRatings.filter((item) => item.name !== skill);
                      return { ...current, skillRatings: [...existing, { id: createId(), name: skill, rating, category: "Core" }] };
                    });
                  }}
                />
                <span>{currentRating}/5</span>
              </label>
            ) : null;
          })}
        </div>
      </div>
    );
  }

  if (section === "experience") {
    return (
      <div className="space-y-4">
        {content.experience.map((item, index) => (
          <div key={item.id} className="rounded-md border bg-neutral-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={item.title} placeholder="Role title" onChange={(event) => updateExperience(index, "title", event.target.value, setContent)} />
              <Input value={item.company} placeholder="Company" onChange={(event) => updateExperience(index, "company", event.target.value, setContent)} list={content.mode === "local" ? "sl-companies" : undefined} />
              <Input value={item.location} placeholder="Location" onChange={(event) => updateExperience(index, "location", event.target.value, setContent)} list={content.mode === "local" ? "sl-districts" : undefined} />
              <Input value={`${item.startDate} - ${item.endDate}`} placeholder="Jan 2024 - Present" onChange={(event) => updateExperienceDates(index, event.target.value, setContent)} />
            </div>
            <div className="mt-4 space-y-2">
              <Label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Bullet Points</Label>
              {item.bullets.map((bullet, bulletIdx) => (
                <div key={bulletIdx} className="space-y-2">
                  <div className="flex gap-2 items-start relative group">
                    <Textarea
                      rows={2}
                      spellCheck
                      className="flex-1 min-h-[60px] text-sm"
                      value={bullet}
                      placeholder="Describe your achievement..."
                      onChange={(event) => {
                        const newBullets = [...item.bullets];
                        newBullets[bulletIdx] = event.target.value;
                        updateExperience(index, "bullets", newBullets, setContent);
                      }}
                    />
                    <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        disabled={improvingBullet?.expIdx === index && improvingBullet?.bulletIdx === bulletIdx}
                        onClick={() => handleImproveBullet(index, bulletIdx, bullet)}
                        title="AI Rewrite"
                      >
                        {improvingBullet?.expIdx === index && improvingBullet?.bulletIdx === bulletIdx ? (
                          <div className="size-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          const newBullets = item.bullets.filter((_, i) => i !== bulletIdx);
                          updateExperience(index, "bullets", newBullets.length ? newBullets : [""], setContent);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {bulletTools[`${index}:${bulletIdx}`] ? (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const tool = bulletTools[`${index}:${bulletIdx}`];
                          const newBullets = [...item.bullets];
                          newBullets[bulletIdx] = tool.original;
                          updateExperience(index, "bullets", newBullets, setContent);
                          setBulletTools((current) => {
                            const next = { ...current };
                            delete next[`${index}:${bulletIdx}`];
                            return next;
                          });
                        }}
                      >
                        <Undo2 className="size-3 mr-1" /> Undo
                      </Button>
                      {bulletTools[`${index}:${bulletIdx}`].options.map((option, optionIndex) => (
                        <Button
                          key={option}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const newBullets = [...item.bullets];
                            newBullets[bulletIdx] = option;
                            updateExperience(index, "bullets", newBullets, setContent);
                          }}
                        >
                          Option {optionIndex + 1}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="mt-1 text-teal-700"
                onClick={() => updateExperience(index, "bullets", [...item.bullets, ""], setContent)}
              >
                <Plus className="size-3 mr-1" /> Add Bullet
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 text-slate-700"
                onClick={() => setLibraryFor(libraryFor === index ? null : index)}
              >
                <BookOpen className="size-3 mr-1" /> Browse examples
              </Button>
              {libraryFor === index ? (
                <div className="grid gap-2 rounded-md border bg-white p-3">
                  {bulletLibrary.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="rounded-md border bg-slate-50 p-2 text-left text-xs leading-5 hover:border-teal-300 hover:bg-teal-50"
                      onClick={() => {
                        updateExperience(index, "bullets", [...item.bullets.filter(Boolean), example], setContent);
                        setLibraryFor(null);
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end border-t mt-4 pt-3">
              <Button type="button" variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => setContent((current) => ({ ...current, experience: current.experience.filter((_, itemIndex) => itemIndex !== index) }))}>
                <Trash2 className="size-4 mr-1.5" />
                {labels.remove} Role
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent((current) => ({ ...current, experience: [...current.experience, { id: createId(), title: "", company: "", location: "", startDate: "", endDate: "", bullets: [""] }] }))}>
          <Plus className="size-4 mr-1.5" />
          {labels.add} Experience
        </Button>
      </div>
    );
  }

  if (section === "education") {
    return (
      <div className="space-y-4">
        {content.education.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-2">
            <Input value={item.degree} placeholder="Degree" onChange={(event) => updateEducation(index, "degree", event.target.value, setContent)} list={content.mode === "local" ? "sl-education-types" : undefined} />
            <Input value={item.field} placeholder="Field" onChange={(event) => updateEducation(index, "field", event.target.value, setContent)} />
            <Input value={item.institution} placeholder="Institution" onChange={(event) => updateEducation(index, "institution", event.target.value, setContent)} list={content.mode === "local" ? "sl-universities" : undefined} />
            <Input value={`${item.startDate} - ${item.endDate}`} placeholder="2020 - 2024" onChange={(event) => updateEducationDates(index, event.target.value, setContent)} />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setContent((current) => ({ ...current, education: [...current.education, { id: createId(), institution: "", degree: "", field: "", startDate: "", endDate: "" }] }))}>
          <Plus className="size-4" />
          {labels.add}
        </Button>
      </div>
    );
  }

  if (section === "projects") {
    return (
      <div className="space-y-4">
        {content.projects.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-2">
            <Input value={item.name} placeholder="Project name" onChange={(event) => updateProject(index, "name", event.target.value, setContent)} />
            <Input value={item.url} placeholder="URL" onChange={(event) => updateProject(index, "url", event.target.value, setContent)} />
            <Textarea className="md:col-span-2" rows={3} value={item.description} placeholder="What did you build or improve?" onChange={(event) => updateProject(index, "description", event.target.value, setContent)} />
            <Input className="md:col-span-2" value={item.technologies.join(", ")} placeholder="Technologies, comma separated" onChange={(event) => updateProject(index, "technologies", event.target.value.split(",").map(part => part.trim()).filter(Boolean), setContent)} />
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent((current) => ({ ...current, projects: [...current.projects, { id: createId(), name: "", description: "", technologies: [], url: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Project
        </Button>
      </div>
    );
  }

  if (section === "languages") {
    return (
      <div className="space-y-4">
        {content.languages?.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-[1fr_1fr_auto]">
            <Input value={item.name} placeholder="e.g. English" onChange={(e) => updateCustomArray(setContent, "languages", index, "name", e.target.value)} />
            <Input value={item.proficiency} placeholder="e.g. Fluent" onChange={(e) => updateCustomArray(setContent, "languages", index, "proficiency", e.target.value)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomArray(setContent, "languages", index)}><Trash2 className="size-4 text-rose-600" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent(c => ({ ...c, languages: [...(c.languages || []), { id: createId(), name: "", proficiency: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Language
        </Button>
      </div>
    );
  }

  if (section === "awards") {
    return (
      <div className="space-y-4">
        {content.awards?.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Input value={item.name} placeholder="Award Name" onChange={(e) => updateCustomArray(setContent, "awards", index, "name", e.target.value)} />
            <Input value={item.issuer} placeholder="Issuer" onChange={(e) => updateCustomArray(setContent, "awards", index, "issuer", e.target.value)} />
            <Input value={item.date} placeholder="Year" onChange={(e) => updateCustomArray(setContent, "awards", index, "date", e.target.value)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomArray(setContent, "awards", index)}><Trash2 className="size-4 text-rose-600" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent(c => ({ ...c, awards: [...(c.awards || []), { id: createId(), name: "", issuer: "", date: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Award
        </Button>
      </div>
    );
  }

  if (section === "volunteering") {
    return (
      <div className="space-y-4">
        {content.volunteering?.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-2">
            <Input value={item.role} placeholder="Role" onChange={(e) => updateCustomArray(setContent, "volunteering", index, "role", e.target.value)} />
            <Input value={item.organization} placeholder="Organization" onChange={(e) => updateCustomArray(setContent, "volunteering", index, "organization", e.target.value)} />
            <Input value={`${item.startDate} - ${item.endDate}`} placeholder="Dates" onChange={(e) => {
              const [s, eDate] = e.target.value.split(" - ");
              setContent(c => {
                const arr = [...(c.volunteering || [])];
                arr[index] = { ...arr[index], startDate: s || "", endDate: eDate || "" };
                return { ...c, volunteering: arr };
              });
            }} />
            <div className="flex justify-end">
               <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomArray(setContent, "volunteering", index)}><Trash2 className="size-4 text-rose-600 mr-1.5" /> Remove</Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent(c => ({ ...c, volunteering: [...(c.volunteering || []), { id: createId(), role: "", organization: "", startDate: "", endDate: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Volunteering
        </Button>
      </div>
    );
  }

  if (section === "publications") {
    return (
      <div className="space-y-4">
        {content.publications?.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-2">
            <Input value={item.title} placeholder="Publication title" onChange={(e) => updateCustomArray(setContent, "publications", index, "title", e.target.value)} />
            <Input value={item.publisher} placeholder="Publisher" onChange={(e) => updateCustomArray(setContent, "publications", index, "publisher", e.target.value)} />
            <Input value={item.date} placeholder="Date" onChange={(e) => updateCustomArray(setContent, "publications", index, "date", e.target.value)} />
            <Input value={item.url} placeholder="URL" onChange={(e) => updateCustomArray(setContent, "publications", index, "url", e.target.value)} />
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent(c => ({ ...c, publications: [...(c.publications || []), { id: createId(), title: "", publisher: "", date: "", url: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Publication
        </Button>
      </div>
    );
  }

  if (section === "references") {
    return (
      <div className="space-y-4">
        {content.references?.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-2">
            <Input value={item.name} placeholder="Referee name" onChange={(e) => updateCustomArray(setContent, "references", index, "name", e.target.value)} />
            <Input value={item.title} placeholder="Position" onChange={(e) => updateCustomArray(setContent, "references", index, "title", e.target.value)} />
            <Input value={item.organization} placeholder="Organization" onChange={(e) => updateCustomArray(setContent, "references", index, "organization", e.target.value)} />
            <Input value={item.relationship} placeholder="Relationship" onChange={(e) => updateCustomArray(setContent, "references", index, "relationship", e.target.value)} />
            <Input value={item.phone} placeholder="Phone" onChange={(e) => updateCustomArray(setContent, "references", index, "phone", e.target.value)} />
            <Input value={item.email} placeholder="Email" onChange={(e) => updateCustomArray(setContent, "references", index, "email", e.target.value)} />
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent(c => ({ ...c, references: [...(c.references || []), { id: createId(), name: "", title: "", organization: "", phone: "", email: "", relationship: "" }] }))}>
          <Plus className="size-4 mr-1.5" /> Add Referee
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {content.certifications.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-md border bg-neutral-50 p-4 md:grid-cols-3">
          <Input value={item.name} placeholder="Certification" list={content.mode === "local" ? "sl-certifications" : undefined} onChange={(event) => updateCertification(index, "name", event.target.value, setContent)} />
          <Input value={item.issuer} placeholder="Issuer" onChange={(event) => updateCertification(index, "issuer", event.target.value, setContent)} />
          <Input value={item.date} placeholder="Date" onChange={(event) => updateCertification(index, "date", event.target.value, setContent)} />
        </div>
      ))}
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setContent((current) => ({ ...current, certifications: [...current.certifications, { id: createId(), name: "", issuer: "", date: "" }] }))}>
        <Plus className="size-4 mr-1.5" /> Add Certification
      </Button>
    </div>
  );
}

function updateCustomArray<K extends "languages" | "awards" | "volunteering" | "publications" | "references">(
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>,
  arrayName: K,
  index: number,
  field: string,
  value: string
) {
  setContent(c => {
    const arr = [...(c[arrayName] as any[])];
    arr[index] = { ...arr[index], [field]: value };
    return { ...c, [arrayName]: arr };
  });
}

function removeCustomArray<K extends "languages" | "awards" | "volunteering" | "publications" | "references">(
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>,
  arrayName: K,
  index: number
) {
  setContent(c => {
    const arr = (c[arrayName] as any[]).filter((_, i) => i !== index);
    return { ...c, [arrayName]: arr };
  });
}

function updateExperience(
  index: number,
  field: "title" | "company" | "location" | "bullets",
  value: string | string[],
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>
) {
  setContent((current) => ({
    ...current,
    experience: current.experience.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
  }));
}

function updateExperienceDates(index: number, value: string, setContent: React.Dispatch<React.SetStateAction<ResumeContent>>) {
  const [startDate = "", endDate = ""] = value.split(" - ");
  setContent((current) => ({
    ...current,
    experience: current.experience.map((item, itemIndex) => (itemIndex === index ? { ...item, startDate, endDate } : item)),
  }));
}

function updateEducation(
  index: number,
  field: "institution" | "degree" | "field",
  value: string,
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>
) {
  setContent((current) => ({
    ...current,
    education: current.education.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
  }));
}

function updateEducationDates(index: number, value: string, setContent: React.Dispatch<React.SetStateAction<ResumeContent>>) {
  const [startDate = "", endDate = ""] = value.split(" - ");
  setContent((current) => ({
    ...current,
    education: current.education.map((item, itemIndex) => (itemIndex === index ? { ...item, startDate, endDate } : item)),
  }));
}

function updateProject(
  index: number,
  field: "name" | "description" | "technologies" | "url",
  value: string | string[],
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>
) {
  setContent((current) => ({
    ...current,
    projects: current.projects.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
  }));
}

function updateCertification(
  index: number,
  field: "name" | "issuer" | "date",
  value: string,
  setContent: React.Dispatch<React.SetStateAction<ResumeContent>>
) {
  setContent((current) => ({
    ...current,
    certifications: current.certifications.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
  }));
}
