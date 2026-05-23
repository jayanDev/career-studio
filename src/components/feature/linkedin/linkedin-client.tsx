"use client";

import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import { 
  Sparkles, Upload, Plus, Trash, Loader2, Check, MapPin, Users, Edit2, 
  CheckSquare, PlusCircle, Globe, Award, FileText, Link2, 
  RefreshCw, Smartphone
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseLinkedInPdfAction, startLinkedInAuditAction } from "@/server/actions/linkedin/audit";

type ExperienceItem = {
  title: string;
  company: string;
  duration: string;
  description: string;
};

export function LinkedInClient({
  t,
  locale = "en",
}: {
  t: (key: string) => string;
  locale?: string;
}) {
  void t;
  // Profile Mockup State
  const [profile, setProfile] = useState<{
    name: string;
    headline: string;
    about: string;
    experience: ExperienceItem[];
    skills: string[];
    profilePhoto: boolean;
    customBanner: boolean;
    vanityUrl: string;
    connections: number;
    recsGiven: number;
    recsReceived: number;
    featuredPopulated: boolean;
    featuredItems: string[];
    complianceMode: boolean;
    audienceMode: "local" | "global";
    profileUrl: string;
    hasOpenToWork: boolean;
    hasOpenToServices: boolean;
    lastPostDate: string;
    postsPerWeek: number;
    avgEngagement: number;
    hashtags: string;
    topEndorsedSkills: string;
    regulatedIndustry: boolean;
    diasporaMode: boolean;
  }>({
    name: "Chanuka Jeewantha",
    headline: "Full Stack Software Engineer | React, Next.js, Node.js",
    about: "A results-driven Full Stack Engineer with over 4 years of experience building modern web applications. Specialized in TypeScript, React, Next.js, and cloud systems.",
    experience: [
      {
        title: "Senior Full Stack Engineer",
        company: "Career Studio Global",
        duration: "2024 - Present",
        description: "Leading the development of Next.js and Prisma-based career advancement products, driving core user engagement metrics up by 40%."
      },
      {
        title: "Software Engineer",
        company: "Lanka Web Solutions",
        duration: "2022 - 2024",
        description: "Designed responsive user interfaces using Tailwind CSS and built scalable backend microservices."
      }
    ],
    skills: ["TypeScript", "Next.js", "React", "Node.js", "Prisma", "PostgreSQL", "TailwindCSS"],
    profilePhoto: true,
    customBanner: false,
    vanityUrl: "chanuka-jeewantha",
    connections: 500,
    recsGiven: 2,
    recsReceived: 4,
    featuredPopulated: true,
    featuredItems: ["GitHub Profile", "Personal Portfolio Website"],
    complianceMode: false,
    audienceMode: "global",
    profileUrl: "https://linkedin.com/in/chanuka-jeewantha",
    hasOpenToWork: false,
    hasOpenToServices: false,
    lastPostDate: "",
    postsPerWeek: 0,
    avgEngagement: 0,
    hashtags: "#SriLankaTech, #ColomboTech",
    topEndorsedSkills: "TypeScript, React, Next.js",
    regulatedIndustry: false,
    diasporaMode: false,
  });

  const [targetRole, setTargetRole] = useState("Senior Full Stack Engineer");
  const [activeTab, setActiveTab] = useState<"edit" | "mockup">("mockup");
  
  // Async states
  const [isParsing, startParseTransition] = useTransition();
  const [isAuditing, startAuditTransition] = useTransition();
  const [isScraping, setIsScraping] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
  const [postPack, setPostPack] = useState<{ hooks: string[]; hashtags: string[]; best_time_to_post: string; story_post: string } | null>(null);
  
  // Job Description state
  const [jdUrl, setJdUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [scrapedKeywords, setScrapedKeywords] = useState<{
    hard_skills: string[];
    soft_skills: string[];
    certifications: string[];
    tools: string[];
    seniority: string;
  } | null>(null);

  // Multi-variant optimizer workbench modal
  const [optimizerModal, setOptimizerModal] = useState<{
    isOpen: boolean;
    section: "headline" | "about";
    variants: {
      visibility: string;
      authority: string;
      opportunity: string;
      story: string;
      clarity: string;
    } | null;
  }>({
    isOpen: false,
    section: "headline",
    variants: null,
  });

  // Featured Item Input
  const [newFeaturedItem, setNewFeaturedItem] = useState("");

  // PDF Profile Drag and Drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 10 * 1024 * 1024,
    onDrop: (accepted) => {
      if (accepted[0]) {
        const formData = new FormData();
        formData.set("profileFile", accepted[0]);
        startParseTransition(async () => {
          try {
            const parsed = await parseLinkedInPdfAction(formData);
            setProfile(prev => ({
              ...prev,
              name: parsed.name || prev.name,
              headline: parsed.headline || prev.headline,
              about: parsed.about || prev.about,
              experience: parsed.experience && parsed.experience.length ? parsed.experience : prev.experience,
              skills: parsed.skills && parsed.skills.length ? parsed.skills : prev.skills,
            }));
          } catch (e) {
            console.error("Failed to parse profile:", e);
          }
        });
      }
    }
  });

  // JD Scraper trigger
  async function handleScrapeJd() {
    if (!jdUrl.trim()) return;
    setIsScraping(true);
    try {
      const res = await fetch("/api/linkedin/scrape-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJdText(data.jobDescription || "");
      if (data.keywords) {
        setScrapedKeywords(data.keywords);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to scrape Job Description. You can paste the description manually below.");
    } finally {
      setIsScraping(false);
    }
  }

  // AI 5-Variant Generator workbench
  async function generateVariants(section: "headline" | "about") {
    setIsGeneratingVariants(true);
    setOptimizerModal({ isOpen: true, section, variants: null });
    try {
      const currentText = section === "headline" ? profile.headline : profile.about;
      const res = await fetch("/api/linkedin/rewrite-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType: section,
          currentText,
          targetRole,
          targetJd: jdText,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOptimizerModal(prev => ({ ...prev, variants: data }));
    } catch (e) {
      console.error(e);
      alert("Failed to generate multi-variant rewrites.");
      setOptimizerModal({ isOpen: false, section, variants: null });
    } finally {
      setIsGeneratingVariants(false);
    }
  }

  function applyVariant(variantText: string) {
    if (optimizerModal.section === "headline") {
      setProfile(prev => ({ ...prev, headline: variantText }));
    } else {
      setProfile(prev => ({ ...prev, about: variantText }));
    }
    setOptimizerModal({ isOpen: false, section: "headline", variants: null });
  }

  async function generatePostPack() {
    setIsGeneratingPosts(true);
    try {
      const profileText = `Headline: ${profile.headline}\nAbout: ${profile.about}\nSkills: ${profile.skills.join(", ")}`;
      const res = await fetch("/api/linkedin/generate-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileText,
          targetRole,
          audienceMode: profile.audienceMode,
          language: profile.audienceMode === "local" ? "en" : "en",
        }),
      });
      const data = await res.json();
      if (!data.error) setPostPack(data);
    } finally {
      setIsGeneratingPosts(false);
    }
  }

  // Trigger full audit backend action
  function handleRunFullAudit() {
    startAuditTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("targetRole", targetRole);
        formData.append("audienceMode", profile.audienceMode);
        formData.append("hasPhoto", String(profile.profilePhoto));
        formData.append("hasBanner", String(profile.customBanner));
        formData.append("vanityUrl", profile.vanityUrl);
        formData.append("recsGiven", String(profile.recsGiven));
        formData.append("recsReceived", String(profile.recsReceived));
        formData.append("featuredPopulated", String(profile.featuredPopulated));
        formData.append("complianceMode", String(profile.complianceMode));
        formData.append("connections", String(profile.connections));
        formData.append("jdText", jdText);
        formData.append("profileUrl", profile.profileUrl);
        formData.append("hasOpenToWork", String(profile.hasOpenToWork));
        formData.append("hasOpenToServices", String(profile.hasOpenToServices));
        formData.append("lastPostDate", profile.lastPostDate);
        formData.append("postsPerWeek", String(profile.postsPerWeek));
        formData.append("avgEngagement", String(profile.avgEngagement));
        formData.append("hashtags", profile.hashtags);
        formData.append("topEndorsedSkills", profile.topEndorsedSkills);
        formData.append("regulatedIndustry", String(profile.regulatedIndustry));
        formData.append("diasporaMode", String(profile.diasporaMode));

        // Serialize structured text for the prompt evaluator
        let serialText = `Name: ${profile.name}\nHeadline: ${profile.headline}\n\nAbout/Summary:\n${profile.about}\n\n`;
        serialText += `Experience List:\n`;
        profile.experience.forEach(exp => {
          serialText += `- ${exp.title} at ${exp.company} (${exp.duration})\n  ${exp.description}\n`;
        });
        serialText += `\nSkills: ${profile.skills.join(", ")}\n`;
        if (profile.featuredPopulated && profile.featuredItems.length) {
          serialText += `Featured Links: ${profile.featuredItems.join(", ")}\n`;
        }
        serialText += `Top Endorsed Skills: ${profile.topEndorsedSkills}\n`;
        serialText += `Hashtags: ${profile.hashtags}\n`;
        serialText += `Profile URL: ${profile.profileUrl}\n`;
        formData.append("profileText", serialText);

        await startLinkedInAuditAction(locale as any, formData);
      } catch (e) {
        console.error("Failed running audit:", e);
      }
    });
  }

  // Experience Handlers
  function addExperience() {
    setProfile(prev => ({
      ...prev,
      experience: [
        ...prev.experience,
        { title: "New Job Title", company: "Company Name", duration: "2024 - Present", description: "Led full-stack features..." }
      ]
    }));
  }

  function updateExperienceField(index: number, field: keyof ExperienceItem, value: string) {
    setProfile(prev => {
      const updated = [...prev.experience];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, experience: updated };
    });
  }

  function removeExperience(index: number) {
    setProfile(prev => ({
      ...prev,
      experience: prev.experience.filter((_, idx) => idx !== index)
    }));
  }

  // Skills Handlers
  const [newSkill, setNewSkill] = useState("");
  function addSkill() {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill("");
    }
  }

  function removeSkill(skill: string) {
    setProfile(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  }

  // Featured handlers
  function addFeaturedItem() {
    if (newFeaturedItem.trim() && !profile.featuredItems.includes(newFeaturedItem.trim())) {
      setProfile(prev => ({ ...prev, featuredItems: [...prev.featuredItems, newFeaturedItem.trim()] }));
      setNewFeaturedItem("");
    }
  }

  function removeFeaturedItem(index: number) {
    setProfile(prev => ({ ...prev, featuredItems: prev.featuredItems.filter((_, i) => i !== index) }));
  }

  const isVanityUrlInvalid = profile.vanityUrl.trim() !== "" && /[0-9a-f]{8,}/i.test(profile.vanityUrl);

  return (
    <div className="space-y-6">
      {/* Upload and Settings Grid */}
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <Upload className="size-4 text-teal-700" />
              1. Profile Data Source
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                isDragActive ? "border-teal-500 bg-teal-50/50" : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50"
              }`}
            >
              <input {...getInputProps()} />
              {isParsing ? (
                <Loader2 className="size-8 text-teal-600 animate-spin" />
              ) : (
                <FileText className="size-8 text-teal-600" />
              )}
              <p className="mt-2 text-sm font-semibold text-neutral-900">
                {isParsing ? "Analyzing Profile Structure..." : "Drop your LinkedIn PDF Export here"}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">Or click to upload PDF from local computer</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <Globe className="size-4 text-teal-700" />
              2. Profile Audit Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
              <div>
                <label className="text-xs font-bold text-neutral-800">Target Region & Market Mode</label>
                <p className="text-[10px] text-neutral-500">Filters check priorities for SL Moat vs Global Remote</p>
              </div>
              <select
                className="h-8 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-semibold"
                value={profile.audienceMode}
                onChange={(e) => setProfile(prev => ({ ...prev, audienceMode: e.target.value as any }))}
              >
                <option value="global">🌐 Global Remote / MNC</option>
                <option value="local">🇱🇰 Sri Lankan Local</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500">Target Role Title</label>
              <Input 
                className="mt-1 text-sm h-9" 
                value={targetRole} 
                onChange={(e) => setTargetRole(e.target.value)} 
                placeholder="e.g. Senior Full Stack Engineer" 
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500">Public Profile URL</label>
              <Input
                className="mt-1 text-xs h-9"
                value={profile.profileUrl}
                onChange={(e) => setProfile(prev => ({ ...prev, profileUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/your-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between rounded-lg border bg-neutral-50 p-2.5 text-xs font-semibold text-neutral-700">
                Open to work
                <input
                  type="checkbox"
                  checked={profile.hasOpenToWork}
                  onChange={(e) => setProfile(prev => ({ ...prev, hasOpenToWork: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border bg-neutral-50 p-2.5 text-xs font-semibold text-neutral-700">
                Open to services
                <input
                  type="checkbox"
                  checked={profile.hasOpenToServices}
                  onChange={(e) => setProfile(prev => ({ ...prev, hasOpenToServices: e.target.checked }))}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleRunFullAudit} 
                disabled={isAuditing}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold h-10 shadow-sm"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Running Deep Audit...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Run Comprehensive Audit
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Job Description Match panel */}
      <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold text-neutral-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Award className="size-4 text-teal-700" />
              Target Job Description Match (Gemini Scraper)
            </span>
            <span className="text-[10px] bg-teal-50 border border-teal-200 text-teal-800 px-2 py-0.5 rounded font-medium">Reuses ATS Engine</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              type="url"
              placeholder="Paste LinkedIn Job URL or Sri Lankan portal link..."
              className="text-xs h-9"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
            />
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs border-neutral-300 hover:bg-neutral-50 h-9"
              onClick={handleScrapeJd}
              disabled={isScraping}
            >
              {isScraping ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1" />
                  Scraping...
                </>
              ) : (
                "Scrape JD URL"
              )}
            </Button>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-500">Pasted Job Description Text</label>
            <Textarea
              className="mt-1 text-xs"
              rows={4}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste job description requirements and skills manually here to match..."
            />
          </div>

          {scrapedKeywords && (
            <div className="bg-teal-50/30 rounded-lg border border-teal-100 p-3 space-y-2">
              <h4 className="text-xs font-bold text-teal-900 flex items-center gap-1">
                <Check className="size-3.5" />
                Gemini Extracted JD Keywords:
              </h4>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {scrapedKeywords.hard_skills.slice(0, 8).map(skill => (
                  <Badge key={skill} variant="outline" className="bg-white border-teal-200 text-[10px] text-teal-800">
                    {skill}
                  </Badge>
                ))}
                {scrapedKeywords.tools.slice(0, 5).map(tool => (
                  <Badge key={tool} variant="outline" className="bg-white border-cyan-200 text-[10px] text-cyan-800">
                    {tool}
                  </Badge>
                ))}
                <span className="text-[10px] text-neutral-500 italic ml-1">
                  Level: {scrapedKeywords.seniority}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <RefreshCw className="size-4 text-teal-700" />
            Activity, Endorsements & Compliance Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-neutral-500">Last post date</label>
              <Input
                type="date"
                className="mt-1 h-9 text-xs"
                value={profile.lastPostDate}
                onChange={(e) => setProfile(prev => ({ ...prev, lastPostDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500">Posts per week</label>
              <Input
                type="number"
                min={0}
                step="0.5"
                className="mt-1 h-9 text-xs"
                value={profile.postsPerWeek}
                onChange={(e) => setProfile(prev => ({ ...prev, postsPerWeek: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500">Avg engagement</label>
              <Input
                type="number"
                min={0}
                className="mt-1 h-9 text-xs"
                value={profile.avgEngagement}
                onChange={(e) => setProfile(prev => ({ ...prev, avgEngagement: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500">Top endorsed skills</label>
              <Input
                className="mt-1 h-9 text-xs"
                value={profile.topEndorsedSkills}
                onChange={(e) => setProfile(prev => ({ ...prev, topEndorsedSkills: e.target.value }))}
                placeholder="React, SQL, Leadership"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              className="text-xs"
              value={profile.hashtags}
              onChange={(e) => setProfile(prev => ({ ...prev, hashtags: e.target.value }))}
              placeholder="#SriLankaTech, #ColomboTech"
            />
            <label className="flex items-center gap-2 rounded-md border px-3 text-xs font-semibold">
              Diaspora
              <input
                type="checkbox"
                checked={profile.diasporaMode}
                onChange={(e) => setProfile(prev => ({ ...prev, diasporaMode: e.target.checked }))}
              />
            </label>
            <label className="flex items-center gap-2 rounded-md border px-3 text-xs font-semibold">
              Regulated
              <input
                type="checkbox"
                checked={profile.regulatedIndustry}
                onChange={(e) => setProfile(prev => ({ ...prev, regulatedIndustry: e.target.checked }))}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold text-neutral-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Edit2 className="size-4 text-teal-700" />
              AI Post Generator
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={generatePostPack} disabled={isGeneratingPosts}>
              {isGeneratingPosts ? <Loader2 className="size-3 animate-spin mr-1" /> : <Sparkles className="size-3 mr-1" />}
              Generate pack
            </Button>
          </CardTitle>
        </CardHeader>
        {postPack ? (
          <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_0.7fr]">
            <div className="rounded-lg border bg-neutral-50 p-3">
              <div className="text-[10px] font-bold uppercase text-neutral-400">Story post</div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-700">{postPack.story_post}</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border bg-teal-50/40 p-3 text-xs text-teal-900">
                Best time: {postPack.best_time_to_post}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {postPack.hashtags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
              {postPack.hooks.slice(0, 3).map((hook) => (
                <div key={hook} className="rounded-md border bg-white p-2 text-xs text-neutral-700">{hook}</div>
              ))}
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* Main Sandbox switcher */}
      <div className="flex justify-between items-center bg-neutral-100/50 p-1 rounded-lg border border-neutral-200 max-w-[280px]">
        <button 
          onClick={() => setActiveTab("mockup")}
          className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-all font-semibold ${
            activeTab === "mockup" ? "bg-white text-neutral-900 shadow-xs border" : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Visual Profile Sandbox
        </button>
        <button 
          onClick={() => setActiveTab("edit")}
          className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-all font-semibold ${
            activeTab === "edit" ? "bg-white text-neutral-900 shadow-xs border" : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Parameters & Form
        </button>
      </div>

      {/* Interactive Mockup Panel */}
      {activeTab === "mockup" && (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          {/* LinkedIn Profile Canvas Mockup */}
          <div className="space-y-6">
            {/* Header card */}
            <Card className="overflow-hidden bg-white border-neutral-200/80 shadow-md rounded-xl">
              {/* LinkedIn Cover Banner */}
              <div className={`h-40 relative flex items-end px-6 justify-between transition-all ${
                profile.customBanner 
                  ? "bg-gradient-to-r from-teal-900 via-emerald-800 to-cyan-900" 
                  : "bg-neutral-200" // Default cosmic blue is generic neutral-200/slate representation
              }`}>
                {/* Banner Toggles */}
                <div className="absolute top-4 right-4 flex gap-1.5 bg-black/40 p-1 rounded-md backdrop-blur-xs">
                  <button 
                    onClick={() => setProfile(prev => ({ ...prev, customBanner: false }))}
                    className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all ${
                      !profile.customBanner ? "bg-white text-neutral-900" : "text-white hover:bg-white/10"
                    }`}
                  >
                    Default Banner
                  </button>
                  <button 
                    onClick={() => setProfile(prev => ({ ...prev, customBanner: true }))}
                    className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all ${
                      profile.customBanner ? "bg-white text-neutral-900" : "text-white hover:bg-white/10"
                    }`}
                  >
                    Custom Banner
                  </button>
                </div>

                <div className="bg-white/20 backdrop-blur-xs text-[9px] text-white/90 py-0.5 px-2 rounded mb-3 border border-white/20">
                  Visual Sandbox Canvas
                </div>
              </div>
              
              <CardContent className="px-6 pb-6 pt-0 relative">
                {/* Avatar container */}
                <div className="absolute -top-16 left-6 size-28 rounded-full border-4 border-white bg-neutral-100 overflow-hidden flex items-center justify-center text-teal-800 text-3xl font-extrabold shadow-sm">
                  {profile.profilePhoto ? (
                    <div className="w-full h-full bg-teal-800 text-white flex items-center justify-center">
                      {profile.name.split(" ").map(n => n[0]).join("")}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                      ?
                    </div>
                  )}
                </div>

                {/* Avatar controller */}
                <button
                  onClick={() => setProfile(prev => ({ ...prev, profilePhoto: !prev.profilePhoto }))}
                  className="absolute top-3 left-36 text-[10px] bg-neutral-100 border hover:bg-neutral-50 px-2 py-0.5 rounded-full font-bold shadow-xs text-neutral-600"
                >
                  {profile.profilePhoto ? "Remove Photo" : "Add Profile Photo"}
                </button>

                <div className="pt-16 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-900">{profile.name}</h2>
                      <span className="text-[10px] bg-teal-50 border border-teal-200 text-teal-800 px-1.5 py-0.5 rounded-md font-bold">1st</span>
                    </div>
                    <p className="text-sm text-neutral-700 font-medium leading-5 max-w-xl">{profile.headline}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-neutral-500 pt-1 flex-wrap font-medium">
                      <span className="flex items-center gap-1"><MapPin className="size-3.5" /> Colombo, Sri Lanka</span>
                      <span className="flex items-center gap-1"><Users className="size-3.5" /> {profile.connections}+ connections</span>
                    </div>

                    <div className="pt-2 flex items-center gap-1 text-[11px] text-neutral-500">
                      <span className="font-bold">Vanity URL:</span>
                      <span className={`font-mono ${isVanityUrlInvalid ? "text-rose-600 font-bold" : "text-teal-700"}`}>
                        linkedin.com/in/{profile.vanityUrl || "not-configured-yet"}
                      </span>
                      {isVanityUrlInvalid && (
                        <span className="text-[9px] text-rose-500 font-semibold italic ml-1">
                          (Contains hash suffix! Change to custom)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs border-teal-700 text-teal-700 hover:bg-teal-50/50"
                      onClick={() => generateVariants("headline")}
                    >
                      <Sparkles className="size-3 text-teal-600 mr-1 animate-pulse" />
                      Optimize Headline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About Card */}
            <Card className="bg-white border-neutral-200/80 shadow-md rounded-xl">
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-neutral-900">About</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs border-teal-700 text-teal-700 hover:bg-teal-50/50"
                  onClick={() => generateVariants("about")}
                >
                  <Sparkles className="size-3 text-teal-600 mr-1 animate-pulse" />
                  Optimize Summary
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-neutral-600 leading-6 whitespace-pre-wrap">{profile.about}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400 border-t pt-2.5">
                  <span>Characters: {profile.about.length} (Target: 1500-2000)</span>
                  {profile.about.length < 200 ? (
                    <span className="text-rose-500 font-semibold">Critically short</span>
                  ) : (
                    <span className="text-teal-600 font-semibold">Good length</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Featured items section */}
            <Card className="bg-white border-neutral-200/80 shadow-md rounded-xl">
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-neutral-900">Featured Links</CardTitle>
                <div className="flex gap-2">
                  <Input 
                    placeholder="New link name..." 
                    className="text-xs h-7 w-40" 
                    value={newFeaturedItem} 
                    onChange={(e) => setNewFeaturedItem(e.target.value)} 
                    onKeyDown={(e) => e.key === "Enter" && addFeaturedItem()}
                  />
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={addFeaturedItem}>
                    <Plus className="size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {profile.featuredItems.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {profile.featuredItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 shadow-xs">
                        <div className="flex items-center gap-2">
                          <Link2 className="size-3.5 text-teal-700" />
                          <span className="text-xs font-semibold text-neutral-800">{item}</span>
                        </div>
                        <button onClick={() => removeFeaturedItem(index)} className="text-neutral-400 hover:text-rose-600">
                          <Trash className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No featured links set. Add some above to improve authority.</p>
                )}
              </CardContent>
            </Card>

            {/* Experience Card */}
            <Card className="bg-white border-neutral-200/80 shadow-md rounded-xl">
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-neutral-900">Experience</CardTitle>
                <Button variant="outline" size="sm" className="text-xs" onClick={addExperience}>
                  <PlusCircle className="size-3.5 mr-1" /> Add Role
                </Button>
              </CardHeader>
              <CardContent className="p-6 divide-y divide-neutral-100">
                {profile.experience.map((exp, index) => (
                  <div key={index} className="py-5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-sm font-bold text-neutral-900">{exp.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 font-medium">
                        <span>{exp.company}</span>
                        <span className="text-neutral-300">•</span>
                        <span>Full-time</span>
                        <span className="text-neutral-300">•</span>
                        <span className="text-neutral-500">{exp.duration}</span>
                      </div>
                      <p className="text-xs leading-5 text-neutral-600 mt-2 whitespace-pre-wrap">{exp.description}</p>
                    </div>

                    <button 
                      onClick={() => removeExperience(index)}
                      className="text-neutral-400 hover:text-rose-600 text-xs flex items-center gap-1"
                    >
                      <Trash className="size-3.5" /> Remove
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills Card */}
            <Card className="bg-white border-neutral-200/80 shadow-md rounded-xl">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-base font-bold text-neutral-900">Skills</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="flex items-center gap-1 bg-neutral-100 text-neutral-800 text-xs px-3 py-1 font-semibold rounded-full border border-neutral-200/60">
                      {skill}
                      <button onClick={() => removeSkill(skill)} className="text-neutral-400 hover:text-rose-600 ml-1">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Audit Checklist Overview */}
          <div className="space-y-6">
            <Card className="sticky top-6 bg-white border-neutral-200/80 shadow-md rounded-xl">
              <CardHeader className="py-4 border-b bg-teal-50/10">
                <CardTitle className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <CheckSquare className="size-4 text-teal-700" />
                  Mockup Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Connections Counter</label>
                    <Input
                      type="number"
                      className="h-8 mt-1 text-xs font-semibold"
                      value={profile.connections}
                      onChange={(e) => setProfile(prev => ({ ...prev, connections: parseInt(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Recs Received</label>
                      <Input
                        type="number"
                        className="h-8 mt-1 text-xs"
                        value={profile.recsReceived}
                        onChange={(e) => setProfile(prev => ({ ...prev, recsReceived: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Recs Given</label>
                      <Input
                        type="number"
                        className="h-8 mt-1 text-xs"
                        value={profile.recsGiven}
                        onChange={(e) => setProfile(prev => ({ ...prev, recsGiven: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs font-semibold text-neutral-700">Featured items toggled</span>
                    <input
                      type="checkbox"
                      className="size-4 text-teal-700 focus:ring-teal-500 rounded border-neutral-300"
                      checked={profile.featuredPopulated}
                      onChange={(e) => setProfile(prev => ({ ...prev, featuredPopulated: e.target.checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <div>
                      <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                        <Smartphone className="size-3 text-neutral-500" />
                        Compliance Lock Mode
                      </span>
                      <p className="text-[9px] text-neutral-400">Masks sensitive govt/bank data</p>
                    </div>
                    <input
                      type="checkbox"
                      className="size-4 text-teal-700 focus:ring-teal-500 rounded border-neutral-300"
                      checked={profile.complianceMode}
                      onChange={(e) => setProfile(prev => ({ ...prev, complianceMode: e.target.checked }))}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Button 
                    onClick={handleRunFullAudit} 
                    disabled={isAuditing}
                    className="w-full bg-teal-800 text-white hover:bg-teal-900 font-bold text-xs h-9"
                  >
                    Run Detailed Audit Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Form Editor Tab Panel */}
      {activeTab === "edit" && (
        <Card className="bg-white border-neutral-200 shadow-sm rounded-xl">
          <CardHeader className="border-b">
            <CardTitle className="text-base font-semibold">Profile Parameters Editor</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-500">Full Name</label>
                <Input 
                  className="mt-1" 
                  value={profile.name} 
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))} 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500">Profile Headline</label>
                <Input 
                  className="mt-1" 
                  value={profile.headline} 
                  onChange={(e) => setProfile(prev => ({ ...prev, headline: e.target.value }))} 
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-500">LinkedIn Vanity URL Slug</label>
                <Input 
                  className="mt-1 font-mono text-xs" 
                  value={profile.vanityUrl} 
                  onChange={(e) => setProfile(prev => ({ ...prev, vanityUrl: e.target.value }))} 
                  placeholder="e.g. chanuka-jeewantha"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500">Connections Counter</label>
                <Input 
                  type="number"
                  className="mt-1 text-xs" 
                  value={profile.connections} 
                  onChange={(e) => setProfile(prev => ({ ...prev, connections: parseInt(e.target.value) || 0 }))} 
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500">Summary / About Section</label>
              <Textarea 
                rows={5} 
                className="mt-1 text-sm" 
                value={profile.about} 
                onChange={(e) => setProfile(prev => ({ ...prev, about: e.target.value }))} 
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-bold text-neutral-900">Experience List</h3>
                <Button size="sm" variant="outline" className="text-xs" onClick={addExperience}>
                  <Plus className="size-3.5 mr-1" /> Add Role
                </Button>
              </div>

              {profile.experience.map((exp, index) => (
                <div key={index} className="rounded-lg border border-neutral-100 bg-neutral-50/30 p-4 space-y-3 relative">
                  <button 
                    type="button" 
                    onClick={() => removeExperience(index)}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-rose-600 transition"
                  >
                    <Trash className="size-4" />
                  </button>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-neutral-500">Job Title</label>
                      <Input 
                        className="mt-1 text-xs" 
                        value={exp.title} 
                        onChange={(e) => updateExperienceField(index, "title", e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-500">Company Name</label>
                      <Input 
                        className="mt-1 text-xs" 
                        value={exp.company} 
                        onChange={(e) => updateExperienceField(index, "company", e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-500">Duration</label>
                      <Input 
                        className="mt-1 text-xs" 
                        value={exp.duration} 
                        onChange={(e) => updateExperienceField(index, "duration", e.target.value)} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-500">Description</label>
                    <Textarea 
                      rows={3} 
                      className="mt-1 text-xs" 
                      value={exp.description} 
                      onChange={(e) => updateExperienceField(index, "description", e.target.value)} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-bold text-neutral-900">Skills Sandbox</h3>
              <div className="flex gap-2 max-w-sm">
                <Input 
                  placeholder="e.g. Next.js" 
                  value={newSkill} 
                  onChange={(e) => setNewSkill(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  className="h-9 text-xs"
                />
                <Button size="sm" onClick={addSkill} className="h-9 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold">
                  Add Skill
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="flex items-center gap-1 bg-neutral-100 text-neutral-800 text-xs px-2.5 py-0.5 rounded-full border border-neutral-200">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="text-neutral-400 hover:text-rose-600">
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-variant AI Optimizer workbench overlay Modal */}
      {optimizerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="py-4 border-b bg-teal-50/10 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                <Sparkles className="size-4 text-teal-600" />
                AI Multivariant Copywriter: {optimizerModal.section === "headline" ? "Headline" : "Summary"} Optimizer
              </CardTitle>
              <button 
                onClick={() => setOptimizerModal({ isOpen: false, section: "headline", variants: null })}
                className="text-neutral-400 hover:text-neutral-900 font-bold text-sm px-2"
              >
                ×
              </button>
            </CardHeader>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {isGeneratingVariants ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="size-8 text-teal-600 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-500 font-semibold">Gemini Copywriter is crafting 5 goal variants...</p>
                </div>
              ) : optimizerModal.variants ? (
                <div className="space-y-4">
                  {[
                    { id: "visibility", label: "🎯 Visibility (Keyword Dense for Recruiters)", text: optimizerModal.variants.visibility },
                    { id: "authority", label: "👑 Authority (Leadership & Outcomes)", text: optimizerModal.variants.authority },
                    { id: "opportunity", label: "🤝 Opportunity (CTA / Hiring-friendly)", text: optimizerModal.variants.opportunity },
                    { id: "story", label: "📖 Story (Narrative Hook Style)", text: optimizerModal.variants.story },
                    { id: "clarity", label: "🎚️ Clarity (Sharp & Minimalist)", text: optimizerModal.variants.clarity },
                  ].map((v) => (
                    <div key={v.id} className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 hover:border-teal-200 transition relative group">
                      <div className="text-xs font-bold text-teal-800">{v.label}</div>
                      <p className="mt-2 text-xs leading-5 text-neutral-700 font-medium whitespace-pre-wrap">
                        {v.text}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button 
                          size="xs" 
                          className="bg-teal-700 hover:bg-teal-800 text-white text-[10px] h-7"
                          onClick={() => applyVariant(v.text)}
                        >
                          Apply to Mockup
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Something went wrong. Close the optimizer and try again.
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-neutral-50 flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs border-neutral-300"
                onClick={() => setOptimizerModal({ isOpen: false, section: "headline", variants: null })}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
