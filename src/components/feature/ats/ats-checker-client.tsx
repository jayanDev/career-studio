"use client";

import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileUp,
  Gauge,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Info,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Wand2,
  Check,
  AlertCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { interpretScore, type AtsScoreResult } from "@/lib/ats-scoring";
import { scoreAtsResumeAction } from "@/server/actions/ats/score-resume";

export function AtsCheckerClient({
  labels,
}: {
  labels: {
    uploadTitle: string;
    uploadBody: string;
    pasteLabel: string;
    jdLabel: string;
    analyze: string;
    scoreTitle: string;
    issues: string;
    suggestions: string;
    jdMatch: string;
  };
}) {
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [result, setResult] = useState<AtsScoreResult | null>(null);
  const [isPending, startTransition] = useTransition();
  
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<"overview" | "simulator" | "bullets" | "hazards" | "tailor">("overview");

  // AI Tailorer & Bullet Rewriter states
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResume, setTailoredResume] = useState("");
  const [rewritingBulletIdx, setRewritingBulletIdx] = useState<number | null>(null);
  const [suggestedRewrites, setSuggestedRewrites] = useState<string[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);
  
  // Sharing/Clipboard states
  const [copiedTailored, setCopiedTailored] = useState(false);
  const [isShared, setIsShared] = useState(false);

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

  function analyze() {
    const formData = new FormData();
    formData.set("resumeText", resumeText);
    formData.set("jobDescription", jobDescription);
    if (file) formData.set("resumeFile", file);

    startTransition(async () => {
      const data = await scoreAtsResumeAction(formData);
      setResult(data);
      if (data.extractedText) {
        setResumeText(data.extractedText);
      }
      setActiveTab("overview");
    });
  }

  async function handleScrapeJd() {
    if (!jdUrl || !jdUrl.startsWith("http")) return;
    setIsScraping(true);
    try {
      const res = await fetch("/api/ats/scrape-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl }),
      });
      const data = await res.json();
      if (data.jobDescription) {
        setJobDescription(data.jobDescription);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScraping(false);
    }
  }

  async function handleTailorResume() {
    if (!resumeText || !jobDescription) return;
    setIsTailoring(true);
    try {
      const res = await fetch("/api/ats/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
      });
      const data = await res.json();
      if (data.tailoredText) {
        setTailoredResume(data.tailoredText);
        setActiveTab("tailor");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTailoring(false);
    }
  }

  async function handleTriggerRewrite(bulletText: string, index: number) {
    setRewritingBulletIdx(index);
    setSuggestedRewrites([]);
    setIsRewriting(true);
    try {
      const res = await fetch("/api/ats/rewrite-bullet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet: bulletText, context: jobDescription }),
      });
      const data = await res.json();
      if (data.rewrites) {
        setSuggestedRewrites(data.rewrites);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  }

  function handleSelectRewrite(newText: string) {
    if (rewritingBulletIdx === null || !result?.bulletAnalysis) return;
    
    // Update bullet locally in result
    const updatedBullets = [...result.bulletAnalysis.bullets];
    if (updatedBullets[rewritingBulletIdx]) {
      updatedBullets[rewritingBulletIdx] = {
        ...updatedBullets[rewritingBulletIdx],
        text: newText,
        actionVerb: true,
        quantified: true,
        xyzFormat: true,
        pronounUsed: false,
        suggestions: []
      };
      
      setResult({
        ...result,
        bulletAnalysis: {
          ...result.bulletAnalysis,
          bullets: updatedBullets
        }
      });
      
      // Update full resumeText text
      const newResumeText = updatedBullets.map(b => b.text).join("\n");
      setResumeText(newResumeText);
    }
    
    setRewritingBulletIdx(null);
    setSuggestedRewrites([]);
  }

  function handleShareReport() {
    if (!result?.id) return;
    const shareUrl = `${window.location.origin}/en/ats/share/${result.id}`;
    navigator.clipboard.writeText(shareUrl);
    setIsShared(true);
    setTimeout(() => setIsShared(false), 2000);
  }

  const interpretation = result ? interpretScore(result.overall) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      {/* Upload and Configuration Form */}
      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 h-fit">
        <CardHeader>
          <CardTitle className="text-teal-400 font-semibold flex items-center gap-2">
            <Sparkles className="size-5" /> Analyze Resume
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            {...getRootProps()}
            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${isDragActive ? "border-teal-500 bg-teal-950/20" : "border-zinc-800 bg-zinc-950/30"}`}
          >
            <input {...getInputProps()} />
            <FileUp className="size-8 text-teal-400" />
            <p className="mt-2 text-sm font-medium text-zinc-200">{file?.name ?? labels.uploadBody}</p>
            <p className="mt-1 text-xs text-zinc-500">PDF, DOC, DOCX, TXT up to 5MB</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Paste Resume Text</label>
            <Textarea 
              className="mt-1.5 bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-teal-500" 
              rows={8} 
              value={resumeText} 
              onChange={(event) => setResumeText(event.target.value)} 
              placeholder="Or paste the text of your resume here..."
            />
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Import Job Description URL</label>
            <div className="flex gap-2 mt-1.5">
              <Input 
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-teal-500 text-xs" 
                value={jdUrl} 
                onChange={(e) => setJdUrl(e.target.value)} 
                placeholder="e.g. topjobs.lk / XpressJobs URL"
              />
              <Button 
                type="button" 
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 text-xs" 
                onClick={handleScrapeJd}
                disabled={isScraping || !jdUrl.trim()}
              >
                {isScraping ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                Import
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">{labels.jdLabel}</label>
            <Textarea 
              className="mt-1.5 bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-teal-500" 
              rows={5} 
              value={jobDescription} 
              onChange={(event) => setJobDescription(event.target.value)} 
              placeholder="Paste job description here to check alignment..."
            />
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              className="flex-1 bg-teal-600 text-zinc-900 hover:bg-teal-500 font-bold transition flex justify-center gap-2 items-center" 
              disabled={isPending || (!file && !resumeText.trim())} 
              onClick={analyze}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
              {labels.analyze}
            </Button>
            {resumeText && jobDescription && (
              <Button 
                type="button" 
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 font-medium"
                disabled={isTailoring}
                onClick={handleTailorResume}
              >
                {isTailoring ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                Tailor
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results View */}
      <Card className="bg-zinc-950 border-zinc-900 text-zinc-100 flex flex-col min-h-[500px]">
        {result && interpretation ? (
          <>
            {/* Results Navigation Header */}
            <div className="border-b border-zinc-900 bg-zinc-900/40 p-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-900 overflow-x-auto max-w-full">
                <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                  Overview
                </TabButton>
                <TabButton active={activeTab === "simulator"} onClick={() => setActiveTab("simulator")}>
                  ATS Simulator
                </TabButton>
                <TabButton active={activeTab === "bullets"} onClick={() => setActiveTab("bullets")}>
                  Bullet Audit
                </TabButton>
                <TabButton active={activeTab === "hazards"} onClick={() => setActiveTab("hazards")}>
                  Hazards & Moat
                </TabButton>
                {tailoredResume && (
                  <TabButton active={activeTab === "tailor"} onClick={() => setActiveTab("tailor")}>
                    Tailored Resume
                  </TabButton>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleShareReport}
                  variant="outline" 
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800 text-xs py-1.5 h-8 flex gap-1.5"
                >
                  <Share2 className="size-3.5" />
                  {isShared ? "Copied Link!" : "Share"}
                </Button>
                <a 
                  href={`/api/ats/export-pdf?resultId=${result.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs px-3 h-8 gap-1.5"
                >
                  <Download className="size-3.5" />
                  PDF Report
                </a>
              </div>
            </div>

            {/* Tab Contents */}
            <CardContent className="p-6 flex-1">
              {/* 1. Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center border-b border-zinc-900 pb-6">
                    <div className="flex items-center gap-4 bg-zinc-900/60 p-5 rounded-lg border border-zinc-800/80 min-w-48 justify-center">
                      <div className="text-center">
                        <div className="text-5xl font-black tracking-tight text-teal-400">{result.overall}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">Overall Fit</div>
                        <Badge className="mt-2.5 rounded bg-teal-950 border border-teal-800 text-teal-300 font-bold hover:bg-teal-950">
                          {interpretation.label}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                      <SubScore label="Format" value={result.format} />
                      <SubScore label="Content" value={result.content} />
                      <SubScore label="Keywords" value={result.keywords} />
                      <SubScore label="Length" value={result.length} />
                    </div>
                  </div>

                  {/* Keywords Fit */}
                  {typeof result.jdKeywordMatchPct === "number" ? (
                    <div className="rounded-lg border border-amber-950/40 bg-amber-950/10 p-5">
                      <div className="font-semibold text-amber-200 flex justify-between items-center text-sm">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-4 text-amber-500" />
                          Job Description Keyword Fit
                        </span>
                        <span className="text-base font-extrabold">{result.jdKeywordMatchPct}%</span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${result.jdKeywordMatchPct}%` }} />
                      </div>
                      
                      {/* Keyword Lists */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-zinc-800/40">
                        <div>
                          <div className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2">Matching Keywords</div>
                          <div className="flex flex-wrap gap-1.5">
                            {result.matchingKeywords?.slice(0, 15).map(kw => (
                              <Badge key={kw} className="bg-teal-950/30 text-teal-300 border border-teal-900/60 font-normal text-[11px] rounded">
                                {kw}
                              </Badge>
                            )) || <span className="text-xs text-zinc-500">None detected</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">Missing Keywords</div>
                          <div className="flex flex-wrap gap-1.5">
                            {result.missingKeywords?.slice(0, 15).map(kw => (
                              <Badge key={kw} className="bg-rose-950/30 text-rose-300 border border-rose-900/60 font-normal text-[11px] rounded">
                                {kw}
                              </Badge>
                            )) || <span className="text-xs text-zinc-500">None missing</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* General Issues & Recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-5">
                      <h3 className="font-semibold text-zinc-200 text-sm border-b border-zinc-900 pb-2 flex items-center gap-2">
                        <AlertCircle className="size-4 text-rose-400" /> Key Issues Flagged
                      </h3>
                      <ul className="mt-3 list-disc pl-4 text-xs leading-5 text-zinc-400 space-y-2">
                        {result.issues.map((item, idx) => <li key={idx}>{item}</li>)}
                        {result.issues.length === 0 && <li>No major issues detected.</li>}
                      </ul>
                    </div>
                    <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-5">
                      <h3 className="font-semibold text-zinc-200 text-sm border-b border-zinc-900 pb-2 flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-teal-400" /> Recommended Actions
                      </h3>
                      <ul className="mt-3 list-disc pl-4 text-xs leading-5 text-zinc-400 space-y-2">
                        {result.suggestions.map((item, idx) => <li key={idx}>{item}</li>)}
                        {result.suggestions.length === 0 && <li>Resume already follows major layout guidelines.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ATS Simulator Tab */}
              {activeTab === "simulator" && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-teal-950/10 border border-teal-900/40 rounded-lg">
                    <Info className="size-5 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-teal-200">ATS Parsing Simulator</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Below is what the ATS literally "sees" when it extracts and catalogs information from your uploaded document. If contact information or experience blocks are empty or garbled, the ATS scanner will automatically filter out your profile.
                      </p>
                    </div>
                  </div>

                  {result.atsSimulator ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Contact & Profile details */}
                      <div className="space-y-4">
                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-5">
                          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-3">Parsed Contact Information</h3>
                          <div className="space-y-2 text-xs">
                            <ParsedItem label="Name" value={result.atsSimulator.contact.name} />
                            <ParsedItem label="Email" value={result.atsSimulator.contact.email} />
                            <ParsedItem label="Phone" value={result.atsSimulator.contact.phone} />
                            <ParsedItem label="Location" value={result.atsSimulator.contact.location} />
                            <ParsedItem label="LinkedIn" value={result.atsSimulator.contact.linkedin} isLink />
                          </div>
                          
                          {result.atsSimulator.contact.issues.length > 0 && (
                            <div className="mt-4 border-t border-zinc-800/50 pt-3">
                              <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                                <AlertTriangle className="size-3" /> Contact Issues
                              </div>
                              <ul className="list-disc pl-4 text-[10px] text-zinc-500 mt-1.5 space-y-1">
                                {result.atsSimulator.contact.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-5">
                          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-3">Parsed Summary</h3>
                          <p className="text-xs text-zinc-400 leading-5 italic">
                            {result.atsSimulator.summary.parsedText || "No introductory summary parsed."}
                          </p>
                        </div>
                        
                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-5">
                          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-3">Skills Detected</h3>
                          <div className="flex flex-wrap gap-1">
                            {result.atsSimulator.skills.map((s, i) => (
                              <Badge key={i} className={`text-[10px] py-0.5 px-2 rounded-md ${s.type === "hard" ? "bg-teal-950 text-teal-300 border border-teal-900" : "bg-zinc-800 text-zinc-300 border border-zinc-700"}`}>
                                {s.name} ({s.type})
                              </Badge>
                            ))}
                            {result.atsSimulator.skills.length === 0 && (
                              <span className="text-xs text-zinc-500">No skills parsed from text.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timeline Experience & Education */}
                      <div className="space-y-4">
                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-5">
                          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-3">Parsed Experience Timeline</h3>
                          <div className="space-y-4">
                            {result.atsSimulator.experience.map((exp, idx) => (
                              <div key={idx} className="border-l border-teal-500/30 pl-3 py-0.5">
                                <div className="text-xs font-bold text-zinc-200">{exp.role || "Untitled Role"}</div>
                                <div className="text-[11px] text-zinc-400">{exp.company || "Unknown Company"} {exp.duration ? `• ${exp.duration}` : ""}</div>
                                {exp.description && (
                                  <p className="text-[10px] text-zinc-500 mt-1 leading-4 truncate">{exp.description}</p>
                                )}
                              </div>
                            ))}
                            {result.atsSimulator.experience.length === 0 && (
                              <span className="text-xs text-zinc-500">No structured roles parsed.</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-5">
                          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-3">Parsed Education</h3>
                          <div className="space-y-3">
                            {result.atsSimulator.education.map((edu, idx) => (
                              <div key={idx} className="border-l border-zinc-700 pl-3">
                                <div className="text-xs font-bold text-zinc-200">{edu.degree || "Degree/Diploma"}</div>
                                <div className="text-[11px] text-zinc-400">{edu.institution || "Institution"} {edu.year ? `• ${edu.year}` : ""}</div>
                              </div>
                            ))}
                            {result.atsSimulator.education.length === 0 && (
                              <span className="text-xs text-zinc-500">No education entries parsed.</span>
                            )}
                          </div>
                        </div>
                        
                        {result.atsSimulator.missingRequiredSections.length > 0 && (
                          <div className="bg-rose-950/20 border border-rose-900/50 rounded-lg p-4 flex gap-2.5 items-start">
                            <AlertCircle className="size-5 text-rose-400 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-rose-200">Missing Required Sections</div>
                              <p className="text-[11px] text-zinc-400 mt-0.5">We could not identify key section headers for: <strong className="text-rose-300">{result.atsSimulator.missingRequiredSections.join(", ")}</strong>. Some ATS filters auto-reject resumes lacking these labels.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-zinc-500 py-8">Parsing simulator data not available.</div>
                  )}
                </div>
              )}

              {/* 3. Bullet Audit Tab */}
              {activeTab === "bullets" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">Sentence & Bullet-Level Impact Audit</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">Line-by-line checks for strong openers, numeric metrics, pronoun counts, and XYZ formatting.</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-teal-400">{result.bulletAnalysis?.impactScore ?? 0}</div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Bullet Impact</div>
                    </div>
                  </div>

                  {/* Bullet Rewriter suggesting popup */}
                  {rewritingBulletIdx !== null && (
                    <div className="bg-zinc-900 border border-teal-900/80 rounded-lg p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <div className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                          <Sparkles className="size-4" /> Gemini AI Bullet Optimizer
                        </div>
                        <Button 
                          onClick={() => setRewritingBulletIdx(null)} 
                          variant="ghost" 
                          className="text-zinc-500 hover:text-zinc-300 h-6 px-2 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                      
                      <div className="text-xs">
                        <div className="text-zinc-500 font-medium">Original:</div>
                        <p className="text-zinc-300 mt-1 italic leading-5">"{result.bulletAnalysis?.bullets[rewritingBulletIdx]?.text}"</p>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Suggested Rewrites (Google XYZ standard):</div>
                        {isRewriting ? (
                          <div className="flex justify-center items-center py-6 text-xs text-zinc-500 gap-2">
                            <Loader2 className="size-4 animate-spin text-teal-400" />
                            Generating high-impact formulations...
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {suggestedRewrites.map((rw, index) => (
                              <div 
                                key={index} 
                                onClick={() => handleSelectRewrite(rw)}
                                className="p-3 bg-zinc-950 hover:bg-teal-950/20 border border-zinc-800 hover:border-teal-900/60 rounded-md cursor-pointer text-xs text-zinc-300 leading-5 transition"
                              >
                                {rw}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {result.bulletAnalysis?.bullets.map((b, idx) => (
                      <div key={idx} className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs text-zinc-300 leading-5 font-mono">"{b.text}"</p>
                          <Button
                            onClick={() => handleTriggerRewrite(b.text, idx)}
                            className="bg-zinc-800 hover:bg-teal-900/40 text-teal-300 border border-zinc-700 h-7 text-[10px] px-2.5 shrink-0 flex gap-1 items-center"
                          >
                            <Wand2 className="size-3" /> Improve
                          </Button>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <Badge className="bg-zinc-950 border border-zinc-800 font-normal text-[10px] text-zinc-400 rounded hover:bg-zinc-950">
                            {b.section}
                          </Badge>
                          <BulletCriteria label="Action Verb" passed={b.actionVerb} />
                          <BulletCriteria label="Quantified" passed={b.quantified} />
                          <BulletCriteria label="XYZ Standard" passed={b.xyzFormat} />
                          <BulletCriteria label="No Pronoun" passed={!b.pronounUsed} />
                          <BulletCriteria label="Length" passed={b.lengthOk} />
                        </div>

                        {b.suggestions.length > 0 && (
                          <div className="text-[11px] text-zinc-500 pl-2 border-l border-zinc-800 flex flex-col gap-1 mt-2">
                            {b.suggestions.map((s, i) => <span key={i} className="leading-4">• {s}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!result.bulletAnalysis?.bullets || result.bulletAnalysis.bullets.length === 0) && (
                      <div className="text-center text-xs text-zinc-500 py-8">No bullets parsed for auditing. Make sure experience timeline details are populated.</div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Hazards & Moat Tab */}
              {activeTab === "hazards" && (
                <div className="space-y-6">
                  {/* Local Sri Lanka MOAT Insights */}
                  {result.sriLankaContext && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-teal-400 flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                        <Sparkles className="size-4" /> Sri Lankan Market MOAT Validation
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <LocalMetricBox 
                          title="Local Companies recognized" 
                          list={result.sriLankaContext.recognizedCompanies} 
                          description="Boosts localized experience verification score."
                        />
                        <LocalMetricBox 
                          title="SL Universities recognized" 
                          list={result.sriLankaContext.recognizedUniversities} 
                          description="Matches local degree pathway requirements."
                        />
                        <LocalMetricBox 
                          title="Professional Certs recognized" 
                          list={result.sriLankaContext.recognizedCerts} 
                          description="Adds valuable industry accreditation credits."
                        />
                      </div>

                      {result.sriLankaContext.hasNicWarning && (
                        <div className="p-4 bg-rose-950/20 border border-rose-900/50 rounded-lg flex gap-3">
                          <AlertTriangle className="size-5 text-rose-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-rose-300">Privacy Advisory: NIC Number Detected</div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Our parser identified a national identity card (NIC) format (e.g. 9-digit suffix V or 12-digit format) in your text. Job boards and public CVs should not expose your NIC to prevent identity theft. Remove it.
                            </p>
                          </div>
                        </div>
                      )}

                      {result.sriLankaContext.tips.length > 0 && (
                        <div className="bg-teal-950/15 border border-teal-900/50 rounded-lg p-5">
                          <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2.5">Moat Improvement Actions</h4>
                          <ul className="list-disc pl-4 text-xs space-y-1.5 text-zinc-400">
                            {result.sriLankaContext.tips.map((tip, idx) => (
                              <li key={idx} className="leading-5">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formatting Hazards */}
                  {result.formattingHazards && (
                    <div className="space-y-4 pt-4 border-t border-zinc-900">
                      <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-1.5 pb-2">
                        <AlertCircle className="size-4" /> ATS Formatting Hazards & Obstacles
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <HazardMetric label="Multi-column checks" failed={result.formattingHazards.hasMultiColumnCrossover} />
                        <HazardMetric label="Tables present" failed={result.formattingHazards.hasTables} />
                        <HazardMetric label="Emojis / non-ASCII" failed={result.formattingHazards.hasEmojis} />
                        <HazardMetric label="Images / diagrams" failed={result.formattingHazards.imageCount > 0} />
                      </div>

                      {result.formattingHazards.issues.length > 0 && (
                        <div className="bg-rose-950/10 border border-rose-900/40 rounded-lg p-4">
                          <ul className="list-disc pl-4 text-xs space-y-1 text-zinc-400 leading-5">
                            {result.formattingHazards.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Tailor Resume Tab */}
              {activeTab === "tailor" && tailoredResume && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">AI Tailored Resume Output</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">Optimized and structured to align perfectly with the target Job Description.</p>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(tailoredResume);
                        setCopiedTailored(true);
                        setTimeout(() => setCopiedTailored(false), 2000);
                      }}
                      className="bg-teal-600 text-zinc-900 hover:bg-teal-500 text-xs flex gap-1.5 items-center font-bold"
                    >
                      {copiedTailored ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copiedTailored ? "Copied!" : "Copy Markdown"}
                    </Button>
                  </div>
                  
                  <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-lg max-h-[600px] overflow-y-auto font-mono text-xs leading-6 text-zinc-300 whitespace-pre-wrap">
                    {tailoredResume}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-sm text-zinc-500 gap-3">
            <Eye className="size-10 text-zinc-700" />
            <p>{labels.uploadBody}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 transition ${active ? "bg-teal-600 text-zinc-950" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"}`}
    >
      {children}
    </button>
  );
}

function SubScore({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">{label}</span>
        <span className="text-sm font-black text-zinc-100">{value}/{max}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-950 overflow-hidden border border-zinc-800 mt-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage >= 80 ? "bg-teal-400" : percentage >= 50 ? "bg-amber-400" : "bg-rose-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function BulletCriteria({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium py-0.5 px-2 rounded-md border ${
      passed 
        ? "bg-teal-950/20 text-teal-300 border-teal-900/60" 
        : "bg-rose-950/20 text-rose-300 border-rose-900/60"
    }`}>
      <span className={`size-1 rounded-full ${passed ? "bg-teal-400" : "bg-rose-400"}`} />
      {label}
    </span>
  );
}

function HazardMetric({ label, failed }: { label: string; failed: boolean }) {
  return (
    <div className={`p-3 border rounded-lg flex flex-col items-center justify-center text-center ${
      failed 
        ? "bg-rose-950/15 border-rose-900/60 text-rose-200" 
        : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
    }`}>
      {failed ? <AlertTriangle className="size-4 text-rose-400 mb-1" /> : <CheckCircle2 className="size-4 text-teal-400 mb-1" />}
      <div className="text-[10px] font-bold tracking-wide uppercase">{label}</div>
      <div className="text-[10px] mt-0.5">{failed ? "Hazard found" : "Clean"}</div>
    </div>
  );
}

function LocalMetricBox({ title, list, description }: { title: string; list: string[]; description: string }) {
  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg">
      <div className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">{title}</div>
      <div className="text-xs font-black text-zinc-100 mt-1">
        {list.length > 0 ? list.join(", ") : "None Detected"}
      </div>
      <p className="text-[9px] text-zinc-500 mt-1">{description}</p>
    </div>
  );
}

function ParsedItem({ label, value, isLink = false }: { label: string; value?: string; isLink?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-zinc-900">
      <span className="text-zinc-500 font-medium">{label}:</span>
      {value ? (
        isLink ? (
          <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline flex items-center gap-0.5">
            {value} <ExternalLink className="size-2.5" />
          </a>
        ) : (
          <span className="text-zinc-200 font-bold">{value}</span>
        )
      ) : (
        <span className="text-zinc-600 italic">Not found</span>
      )}
    </div>
  );
}
