"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Sparkles, Trash2, Globe, MapPin, CheckCircle2 } from "lucide-react";

import { ResumePreview } from "@/components/feature/resumes/resume-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createId, resumeSectionKeys, type ResumeContent, type ResumeSectionKey } from "@/lib/resume-content";
import { getLiveAtsScoreAction, improveResumeTextAction, saveResumeContentAction } from "@/server/actions/resumes/create-resume";

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
  const [isPending, startTransition] = useTransition();

  // Bullet AI state
  const [improvingBullet, setImprovingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);

  const [atsScore, setAtsScore] = useState<any>(null);

  useEffect(() => {
    setSaveState(labels.saving);
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        await saveResumeContentAction(resumeId, content);
        const score = await getLiveAtsScoreAction(content);
        setAtsScore(score);
        setSaveState(labels.saved);
        setLastSaved(new Date());
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
      <div className="space-y-4">
        {/* Top toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-white px-4 py-3 gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={content.mode === "local" ? "default" : "outline"}
              size="sm"
              onClick={() => setContent(c => ({ ...c, mode: "local" }))}
              className={content.mode === "local" ? "bg-teal-700 hover:bg-teal-800" : ""}
            >
              <MapPin className="size-4 mr-1.5" />
              Local SL
            </Button>
            <Button
              variant={content.mode === "international" ? "default" : "outline"}
              size="sm"
              onClick={() => setContent(c => ({ ...c, mode: "international" }))}
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
          <Button type="button" variant="outline" size="sm" onClick={improveSummary}>
            <Sparkles className="size-4 mr-1.5 text-amber-500" />
            {labels.improve}
          </Button>
        </div>

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
                  {renderEditor(section, content, setContent, setHeaderField, labels, handleImproveBullet, improvingBullet)}
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
           </CardContent>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-950">{labels.livePreview}</h2>
          </div>
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
  improvingBullet: { expIdx: number; bulletIdx: number } | null
) {
  if (section === "header") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {(["fullName", "title", "email", "phone", "location", "linkedin", "website"] as const).map((field) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field} className="capitalize">{field}</Label>
            <Input id={field} value={content.header[field]} onChange={(event) => setHeaderField(field, event.target.value)} />
          </div>
        ))}
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
          onChange={(event) => setContent((current) => ({ ...current, skills: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }))}
        />
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
              <Input value={item.company} placeholder="Company" onChange={(event) => updateExperience(index, "company", event.target.value, setContent)} />
              <Input value={item.location} placeholder="Location" onChange={(event) => updateExperience(index, "location", event.target.value, setContent)} />
              <Input value={`${item.startDate} - ${item.endDate}`} placeholder="Jan 2024 - Present" onChange={(event) => updateExperienceDates(index, event.target.value, setContent)} />
            </div>
            <div className="mt-4 space-y-2">
              <Label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Bullet Points</Label>
              {item.bullets.map((bullet, bulletIdx) => (
                <div key={bulletIdx} className="flex gap-2 items-start relative group">
                  <Textarea
                    rows={2}
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
            <Input value={item.degree} placeholder="Degree" onChange={(event) => updateEducation(index, "degree", event.target.value, setContent)} />
            <Input value={item.field} placeholder="Field" onChange={(event) => updateEducation(index, "field", event.target.value, setContent)} />
            <Input value={item.institution} placeholder="Institution" onChange={(event) => updateEducation(index, "institution", event.target.value, setContent)} />
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
    return <Textarea rows={5} value={content.projects.map((item) => `${item.name}: ${item.description}`).join("\n")} readOnly />;
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

  return <Textarea rows={4} value={content.certifications.map((item) => `${item.name} - ${item.issuer}`).join("\n")} readOnly />;
}

function updateCustomArray<K extends "languages" | "awards" | "volunteering">(
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

function removeCustomArray<K extends "languages" | "awards" | "volunteering">(
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
