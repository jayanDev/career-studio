"use client";

import React, { useState, startTransition } from "react";
import { toast } from "sonner";
import { 
  Sparkles, Plus, Trash2, Award, Briefcase, GraduationCap, 
  Wrench, FolderGit, HeartHandshake, FileText, Settings2, 
  Check, Save, Eye, User, Globe, Lock, ShieldCheck, Upload, Languages
} from "lucide-react";
import type { 
  TalentProfile, TalentExperience, TalentEducation, 
  TalentSkill, TalentProject, TalentService, 
  TalentPortfolio, TalentCertification, TalentAward 
} from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

import { 
  updateTalentBaseInfo, updateTalentPrivacy, updateTalentProfileImages,
  saveExperience, deleteExperience, saveEducation, deleteEducation,
  addSkill, deleteSkill, toggleTopSkill, saveProject, deleteProject,
  saveService, deleteService, savePortfolio, deletePortfolio,
  saveCertification, deleteCertification, saveAward, deleteAward, saveCVPath
} from "@/server/actions/talent";

import { generateHeadline, generateAbout, rewriteExperienceBullets } from "@/server/actions/ai-talent";

interface ProfileBuilderProps {
  initialProfile: TalentProfile & {
    experiences: TalentExperience[];
    educations: TalentEducation[];
    skills: TalentSkill[];
    projects: TalentProject[];
    services: TalentService[];
    portfolios: TalentPortfolio[];
    certifications: TalentCertification[];
    awards: TalentAward[];
  };
  locale: string;
}

export function ProfileBuilder({ initialProfile, locale }: ProfileBuilderProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState("about");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Forms states
  const [baseInfo, setBaseInfo] = useState({
    headline: profile.headline,
    bio: profile.bio,
    city: profile.city,
    country: profile.country,
    targetLocation: profile.targetLocation,
    isOpenToWork: profile.isOpenToWork,
    preferredJobTypes: Array.isArray(profile.preferredJobTypes) ? (profile.preferredJobTypes as string[]) : [],
    industry: profile.industry,
    careerLevel: profile.careerLevel,
    expectedSalary: profile.expectedSalary,
    isExpectedSalaryPublic: profile.isExpectedSalaryPublic,
    noticePeriod: profile.noticePeriod,
    nationality: profile.nationality,
    visaStatus: profile.visaStatus,
  });

  const [privacy, setPrivacy] = useState({
    customSlug: profile.customSlug || "",
    isPhonePublic: profile.isPhonePublic,
    isEmailPublic: profile.isEmailPublic,
    visibility: profile.visibility as "public" | "recruiters_only" | "private",
  });

  // Modal open states
  const [isExpOpen, setIsExpOpen] = useState(false);
  const [isEduOpen, setIsEduOpen] = useState(false);
  const [isProjOpen, setIsProjOpen] = useState(false);
  const [isSkillOpen, setIsSkillOpen] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [isServOpen, setIsServOpen] = useState(false);
  const [isPortOpen, setIsPortOpen] = useState(false);

  // Modal edit item states
  const [editExp, setEditExp] = useState<Partial<TalentExperience>>({});
  const [editEdu, setEditEdu] = useState<Partial<TalentEducation>>({});
  const [editProj, setEditProj] = useState<Partial<TalentProject>>({});
  const [editSkill, setEditSkill] = useState<Partial<TalentSkill>>({});
  const [editCert, setEditCert] = useState<Partial<TalentCertification>>({});
  const [editAward, setEditAward] = useState<Partial<TalentAward>>({});
  const [editServ, setEditServ] = useState<Partial<TalentService>>({});
  const [editPort, setEditPort] = useState<Partial<TalentPortfolio>>({});

  // AI suggestions list
  const [aiHeadlines, setAiHeadlines] = useState<string[]>([]);
  const [isHeadlineDialogOpen, setIsHeadlineDialogOpen] = useState(false);

  // Save core settings
  const handleSaveBaseInfo = async () => {
    try {
      await updateTalentBaseInfo({
        ...baseInfo,
        languages: [], // Optional languages array
        availabilityDate: null,
      });
      toast.success("Profile basic information updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile info");
    }
  };

  const handleSavePrivacy = async () => {
    try {
      await updateTalentPrivacy(privacy);
      toast.success("Privacy configurations updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save privacy settings");
    }
  };

  // AI Headline Generator
  const triggerHeadlineAi = async () => {
    if (!baseInfo.headline && profile.skills.length === 0) {
      toast.error("Please enter your current title or add skills first so AI can suggest headlines.");
      return;
    }
    setIsAiLoading(true);
    try {
      const skillsArray = profile.skills.map(s => s.name);
      const suggestions = await generateHeadline({
        currentRole: baseInfo.headline || "Professional",
        skills: skillsArray.length > 0 ? skillsArray : ["Management"],
        industry: baseInfo.industry,
      });
      setAiHeadlines(suggestions);
      setIsHeadlineDialogOpen(true);
    } catch (err) {
      toast.error("Failed to generate AI headlines.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Bio Summary Generator
  const triggerAboutAi = async () => {
    if (!baseInfo.headline) {
      toast.error("Please fill in your headline/role before generating your about summary.");
      return;
    }
    setIsAiLoading(true);
    try {
      const skillsArray = profile.skills.map(s => s.name);
      const summary = await generateAbout({
        role: baseInfo.headline,
        skills: skillsArray.length > 0 ? skillsArray : ["Innovation"],
        experienceYears: 3,
        tone: "professional",
      });
      setBaseInfo(prev => ({ ...prev, bio: summary }));
      toast.success("AI generated summary added to About section! Remember to save changes.");
    } catch (err) {
      toast.error("Failed to generate about summary.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Experience Description Polish
  const triggerBulletAi = async (jobTitle: string, desc: string, callback: (bullets: string[]) => void) => {
    if (!desc) {
      toast.error("Please fill in some description/responsibilities to polish with AI.");
      return;
    }
    setIsAiLoading(true);
    try {
      const bullets = await rewriteExperienceBullets({
        jobTitle,
        originalDescription: desc,
      });
      callback(bullets);
      toast.success("AI rewritten achievement bullets created!");
    } catch (err) {
      toast.error("Failed to polish details.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-teal-900/10 via-background to-teal-950/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex size-20 items-center justify-center rounded-full bg-teal-100 ring-4 ring-teal-50/50 text-teal-800 font-bold text-2xl">
              {profile.profileImage ? (
                <img src={profile.profileImage} alt={baseInfo.headline} className="size-full rounded-full object-cover" />
              ) : (
                <User className="size-10" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{baseInfo.headline || "Your Name"}</h1>
              <p className="text-sm text-muted-foreground">{baseInfo.city}, {baseInfo.country} • {baseInfo.industry || "General Industry"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={privacy.visibility === "public" ? "default" : "outline"} className="gap-1">
                  {privacy.visibility === "public" ? <Globe className="size-3" /> : <Lock className="size-3" />}
                  {privacy.visibility}
                </Badge>
                {baseInfo.isOpenToWork && <Badge className="bg-teal-700 hover:bg-teal-800">Open to Work</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Profile Strength</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-teal-700">{profile.completionScore}%</span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${profile.completionScore}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Navigation Sidebar */}
        <aside className="space-y-1">
          <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
            {[
              { id: "about", label: "About & Header", icon: User },
              { id: "experience", label: "Experience", icon: Briefcase },
              { id: "education", label: "Education", icon: GraduationCap },
              { id: "skills", label: "Skills", icon: Wrench },
              { id: "projects", label: "Projects", icon: FolderGit },
              { id: "services", label: "Services", icon: HeartHandshake },
              { id: "certifications", label: "Certifications", icon: ShieldCheck },
              { id: "awards", label: "Awards & Honors", icon: Award },
              { id: "cv", label: "Resume CV Upload", icon: FileText },
              { id: "privacy", label: "Privacy & URL", icon: Settings2 },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 rounded-lg py-2 ${activeTab === tab.id ? "bg-teal-50 text-teal-900 font-semibold" : "text-muted-foreground"}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon className="size-4 shrink-0 text-teal-700" />
                <span>{tab.label}</span>
              </Button>
            ))}
          </TabsList>
        </aside>

        {/* Form Containers */}
        <main className="space-y-6">
          {/* About Section */}
          {activeTab === "about" && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>General Information</span>
                  <Button variant="outline" size="sm" onClick={triggerHeadlineAi} disabled={isAiLoading} className="gap-1.5 border-teal-200 text-teal-800 hover:bg-teal-50">
                    <Sparkles className="size-3.5 fill-teal-100" />
                    <span>AI Headlines</span>
                  </Button>
                </CardTitle>
                <CardDescription>Configure your headline bio, current location, target role and professional description.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="headline">Professional Headline / Role</Label>
                    <Input 
                      id="headline" 
                      placeholder="e.g. Associate Software Engineer | React | Node.js" 
                      value={baseInfo.headline}
                      onChange={(e) => setBaseInfo(prev => ({ ...prev, headline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input 
                      id="industry" 
                      placeholder="e.g. Software Development" 
                      value={baseInfo.industry}
                      onChange={(e) => setBaseInfo(prev => ({ ...prev, industry: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      placeholder="e.g. Colombo" 
                      value={baseInfo.city}
                      onChange={(e) => setBaseInfo(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input 
                      id="country" 
                      placeholder="e.g. Sri Lanka" 
                      value={baseInfo.country}
                      onChange={(e) => setBaseInfo(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="careerLevel">Career Level</Label>
                    <select
                      id="careerLevel"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
                      value={baseInfo.careerLevel}
                      onChange={(e) => setBaseInfo(prev => ({ ...prev, careerLevel: e.target.value }))}
                    >
                      <option value="student">Student</option>
                      <option value="fresher">Fresher / Graduate</option>
                      <option value="junior">Junior</option>
                      <option value="mid">Mid-Level</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead / Tech Lead</option>
                      <option value="executive">Executive Management</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bio">About Summary</Label>
                    <Button variant="ghost" size="xs" onClick={triggerAboutAi} disabled={isAiLoading} className="text-teal-800 gap-1">
                      <Sparkles className="size-3" />
                      <span>Write with AI</span>
                    </Button>
                  </div>
                  <Textarea 
                    id="bio" 
                    rows={6}
                    placeholder="Describe your achievements, technical expertise, and career aspirations..." 
                    value={baseInfo.bio}
                    onChange={(e) => setBaseInfo(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="isOpenToWork" 
                      checked={baseInfo.isOpenToWork}
                      onCheckedChange={(checked) => setBaseInfo(prev => ({ ...prev, isOpenToWork: checked }))}
                    />
                    <Label htmlFor="isOpenToWork" className="cursor-pointer">Actively Open to Opportunities</Label>
                  </div>
                  <Button className="bg-teal-700 text-white hover:bg-teal-800 gap-2" onClick={handleSaveBaseInfo}>
                    <Save className="size-4" />
                    <span>Save Changes</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Experience Section */}
          {activeTab === "experience" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Experience Timeline</CardTitle>
                  <CardDescription>Manage your career history records displayed on your public profile.</CardDescription>
                </div>
                <Button onClick={() => { setEditExp({}); setIsExpOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Experience</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.experiences.map((exp) => (
                  <div key={exp.id} className="flex items-start justify-between rounded-xl border p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex gap-3">
                      <div className="mt-1 flex size-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                        <Briefcase className="size-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                        <p className="text-sm font-medium text-slate-600">{exp.companyName} • {exp.location}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(exp.startDate).toLocaleDateString(locale, { month: "short", year: "numeric" })} - {" "}
                          {exp.isCurrent ? "Present" : exp.endDate ? new Date(exp.endDate).toLocaleDateString(locale, { month: "short", year: "numeric" }) : ""}
                        </p>
                        {exp.description && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{exp.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditExp(exp); setIsExpOpen(true); }} className="size-8">
                        <Settings2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteExperience(exp.id)} className="size-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {profile.experiences.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No experience records added yet. Add records to build your timeline.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Education Section */}
          {activeTab === "education" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Education History</CardTitle>
                  <CardDescription>Add academic credentials, university degrees, and other certifications.</CardDescription>
                </div>
                <Button onClick={() => { setEditEdu({}); setIsEduOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Education</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.educations.map((edu) => (
                  <div key={edu.id} className="flex items-start justify-between rounded-xl border p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex gap-3">
                      <div className="mt-1 flex size-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                        <GraduationCap className="size-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{edu.degree}</h4>
                        <p className="text-sm font-medium text-slate-600">{edu.institutionName} {edu.fieldOfStudy && `• ${edu.fieldOfStudy}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(edu.startDate).getFullYear()} - {edu.isOngoing ? "Ongoing" : edu.endDate ? new Date(edu.endDate).getFullYear() : ""}
                        </p>
                        {edu.gpa && <p className="mt-1 text-xs font-semibold text-teal-700">GPA: {edu.gpa}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditEdu(edu); setIsEduOpen(true); }} className="size-8">
                        <Settings2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteEducation(edu.id)} className="size-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {profile.educations.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No education history added yet.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Skills Section */}
          {activeTab === "skills" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Skills Inventory</CardTitle>
                  <CardDescription>Declare keywords, soft skills, and tools. Highlight up to 5 featured skills.</CardDescription>
                </div>
                <Button onClick={() => { setEditSkill({}); setIsSkillOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Skill</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2.5">
                  {profile.skills.map((skill) => (
                    <Badge 
                      key={skill.name} 
                      variant={skill.isTop ? "default" : "outline"} 
                      className={`gap-1.5 py-1 px-3 ${skill.isTop ? "bg-teal-700 hover:bg-teal-800" : ""}`}
                    >
                      <span>{skill.name}</span>
                      <span className="text-[10px] opacity-70">({skill.proficiency})</span>
                      <button 
                        onClick={() => toggleTopSkill(skill.name, !skill.isTop)}
                        className="hover:text-teal-200 transition-colors ml-1"
                        title={skill.isTop ? "Unpin skill" : "Pin as top skill"}
                      >
                        ★
                      </button>
                      <button 
                        onClick={() => deleteSkill(skill.name)}
                        className="hover:text-red-300 font-bold ml-1"
                        title="Delete skill"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                {profile.skills.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No skills added yet. Add technical or professional competencies.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Projects Section */}
          {activeTab === "projects" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Projects Portfolio</CardTitle>
                  <CardDescription>Showcase academic, professional, freelance, or personal design/code projects.</CardDescription>
                </div>
                <Button onClick={() => { setEditProj({}); setIsProjOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Project</span>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {profile.projects.map((proj) => (
                  <div key={proj.id} className="flex flex-col justify-between rounded-xl border p-4 hover:shadow-sm transition-all bg-card">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-slate-900">{proj.title}</h4>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditProj(proj); setIsProjOpen(true); }} className="size-8">
                            <Settings2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteProject(proj.id)} className="size-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <Badge variant="secondary" className="mb-2">{proj.projectType}</Badge>
                      <p className="text-sm text-muted-foreground line-clamp-3">{proj.description}</p>
                      {proj.tools && (proj.tools as string[]).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(proj.tools as string[]).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {profile.projects.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">No projects featured yet.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Services Section */}
          {activeTab === "services" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Services Offered</CardTitle>
                  <CardDescription>Promote freelance services, coaching consulting or design offerings.</CardDescription>
                </div>
                <Button onClick={() => { setEditServ({}); setIsServOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Service</span>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {profile.services.map((serv) => (
                  <div key={serv.id} className="rounded-xl border p-4 bg-slate-50 flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{serv.title}</h4>
                      {serv.pricing && <p className="text-xs text-teal-800 font-bold mt-1">Starting from: {serv.pricing}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{serv.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditServ(serv); setIsServOpen(true); }} className="size-8">
                        <Settings2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteService(serv.id)} className="size-8 text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {profile.services.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">No freelance services defined.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Certifications Section */}
          {activeTab === "certifications" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Professional Certifications</CardTitle>
                  <CardDescription>Verify your credibility by detailing certifications or badges.</CardDescription>
                </div>
                <Button onClick={() => { setEditCert({}); setIsCertOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Certification</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.certifications.map((cert) => (
                  <div key={cert.id} className="flex justify-between items-center rounded-xl border p-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-semibold">{cert.name}</h4>
                      <p className="text-sm text-muted-foreground">{cert.issuingOrg}</p>
                      {cert.credentialId && <p className="text-xs text-slate-500 mt-1">ID: {cert.credentialId}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditCert(cert); setIsCertOpen(true); }} className="size-8">
                        <Settings2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCertification(cert.id)} className="size-8 text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {profile.certifications.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No certifications registered yet.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Awards Section */}
          {activeTab === "awards" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Awards & Achievements</CardTitle>
                  <CardDescription>Record awards, honors, competitions or employee performance recognitions.</CardDescription>
                </div>
                <Button onClick={() => { setEditAward({}); setIsAwardOpen(true); }} className="bg-teal-700 text-white hover:bg-teal-800 gap-1">
                  <Plus className="size-4" />
                  <span>Add Award</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.awards.map((award) => (
                  <div key={award.id} className="flex justify-between items-center rounded-xl border p-4 bg-slate-55 hover:bg-slate-50">
                    <div>
                      <h4 className="font-semibold">{award.title}</h4>
                      <p className="text-xs text-teal-850 font-bold">{award.issuer}</p>
                      <p className="text-xs text-muted-foreground mt-2">{award.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditAward(award); setIsAwardOpen(true); }} className="size-8">
                        <Settings2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteAward(award.id)} className="size-8 text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {profile.awards.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No awards listed.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resume CV Section */}
          {activeTab === "cv" && (
            <Card>
              <CardHeader>
                <CardTitle>Curriculum Vitae (CV) Upload</CardTitle>
                <CardDescription>Upload a recruiter-safe PDF resume. Recruiters can view profile and request CV download.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  <Upload className="mx-auto size-10 text-muted-foreground mb-4" />
                  <h4 className="font-semibold mb-1">Upload Public Resume (PDF only)</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">Provide a professional copy. Private information like direct phone number is safe.</p>
                  <div className="flex justify-center">
                    {/* Simulated Upload Button */}
                    <Button 
                      onClick={() => {
                        saveCVPath("/resumes/sample-cv.pdf", "Chanuka_Jeewantha_CV.pdf");
                        toast.success("Mock CV upload processed! Score updated.");
                      }}
                      className="bg-teal-700 hover:bg-teal-800 text-white"
                    >
                      Simulate PDF Upload
                    </Button>
                  </div>
                </div>

                {profile.cvPath && (
                  <div className="flex items-center justify-between rounded-xl border p-4 bg-teal-50/30">
                    <div className="flex items-center gap-3">
                      <FileText className="size-8 text-teal-800" />
                      <div>
                        <h4 className="font-semibold text-sm">{profile.cvFilename || "Candidate_CV.pdf"}</h4>
                        <p className="text-xs text-muted-foreground">PDF CV is active in Talent Pool</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => saveCVPath(null, null)} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Privacy & URL Settings */}
          {activeTab === "privacy" && (
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Custom URL Settings</CardTitle>
                <CardDescription>Protect personal details, create public URLs, and manage pool visibility status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customSlug">Custom Profile URL Slug</Label>
                    <div className="flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        careerstudio.lk/talent/
                      </span>
                      <Input 
                        id="customSlug" 
                        placeholder="amal-perera"
                        className="rounded-l-none"
                        value={privacy.customSlug}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, customSlug: e.target.value }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Use alphanumeric characters and hyphens for a clean vanity URL.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visibility">Pool Visibility</Label>
                    <select
                      id="visibility"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
                      value={privacy.visibility}
                      onChange={(e) => setPrivacy(prev => ({ ...prev, visibility: e.target.value as any }))}
                    >
                      <option value="public">Public (Anyone can view, recruiter-safe details)</option>
                      <option value="recruiters_only">Recruiters Only (Only verified hiring managers)</option>
                      <option value="private">Private (Hidden from the marketplace)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-sm">Direct Contact Protection</h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="isEmailPublic" className="cursor-pointer">Reveal Email to Recruiters Directly</Label>
                      <p className="text-xs text-muted-foreground">If disabled, recruiters must submit contact requests first.</p>
                    </div>
                    <Switch 
                      id="isEmailPublic" 
                      checked={privacy.isEmailPublic}
                      onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, isEmailPublic: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="isPhonePublic" className="cursor-pointer">Reveal Phone Number to Public</Label>
                      <p className="text-xs text-muted-foreground">Toggle public phone visibility (Highly discouraged to protect privacy).</p>
                    </div>
                    <Switch 
                      id="isPhonePublic" 
                      checked={privacy.isPhonePublic}
                      onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, isPhonePublic: checked }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t pt-4">
                  <Button className="bg-teal-700 text-white hover:bg-teal-800 gap-2" onClick={handleSavePrivacy}>
                    <Save className="size-4" />
                    <span>Save Privacy Settings</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* AI Headline Choice Dialog */}
      <Dialog open={isHeadlineDialogOpen} onOpenChange={setIsHeadlineDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-teal-850">
              <Sparkles className="size-5 fill-teal-100" />
              <span>AI Suggested Headlines</span>
            </DialogTitle>
            <DialogDescription>Pick a professional headline option generated based on your profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {aiHeadlines.map((headline, idx) => (
              <button
                key={idx}
                className="w-full text-left p-3 rounded-lg border hover:bg-teal-50/50 hover:border-teal-300 transition-all font-medium text-sm text-slate-800"
                onClick={() => {
                  setBaseInfo(prev => ({ ...prev, headline }));
                  setIsHeadlineDialogOpen(false);
                  toast.success("Headline selected!");
                }}
              >
                {headline}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* dialog modals for adding/editing items */}
      {/* Experience Dialog */}
      <Dialog open={isExpOpen} onOpenChange={setIsExpOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>{editExp.id ? "Edit Experience" : "Add Experience"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveExperience({
                id: editExp.id,
                title: formData.get("title") as string,
                companyName: formData.get("companyName") as string,
                location: formData.get("location") as string,
                employmentType: formData.get("employmentType") as string,
                startDate: new Date(formData.get("startDate") as string),
                endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
                isCurrent: formData.get("isCurrent") === "on",
                description: formData.get("description") as string,
                skillsUsed: [],
              });
              setIsExpOpen(false);
              toast.success("Experience record saved!");
            } catch (err: any) {
              toast.error(err.message || "Failed to save experience");
            }
          }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exp-title">Job Title</Label>
                <Input id="exp-title" name="title" defaultValue={editExp.title || ""} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-company">Company Name</Label>
                <Input id="exp-company" name="companyName" defaultValue={editExp.companyName || ""} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exp-location">Location</Label>
                <Input id="exp-location" name="location" defaultValue={editExp.location || ""} placeholder="e.g. Colombo, LK" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-type">Employment Type</Label>
                <select id="exp-type" name="employmentType" defaultValue={editExp.employmentType || "full_time"} className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm">
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exp-start">Start Date</Label>
                <Input id="exp-start" name="startDate" type="date" defaultValue={editExp.startDate ? new Date(editExp.startDate).toISOString().split("T")[0] : ""} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-end">End Date</Label>
                <Input id="exp-end" name="endDate" type="date" defaultValue={editExp.endDate ? new Date(editExp.endDate).toISOString().split("T")[0] : ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="exp-current" name="isCurrent" defaultChecked={editExp.isCurrent || false} />
              <Label htmlFor="exp-current" className="cursor-pointer">Currently working here</Label>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label htmlFor="exp-desc">Description</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="xs" 
                  onClick={() => {
                    const textEl = document.getElementById("exp-desc") as HTMLTextAreaElement;
                    const titleEl = document.getElementById("exp-title") as HTMLInputElement;
                    triggerBulletAi(titleEl.value, textEl.value, (bullets) => {
                      textEl.value = bullets.map(b => `• ${b}`).join("\n");
                    });
                  }} 
                  className="text-teal-800 gap-1"
                >
                  <Sparkles className="size-3" />
                  <span>Polish with AI</span>
                </Button>
              </div>
              <Textarea id="exp-desc" name="description" defaultValue={editExp.description || ""} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Education Dialog */}
      <Dialog open={isEduOpen} onOpenChange={setIsEduOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>{editEdu.id ? "Edit Education" : "Add Education"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveEducation({
                id: editEdu.id,
                institutionName: formData.get("institutionName") as string,
                degree: formData.get("degree") as string,
                fieldOfStudy: formData.get("fieldOfStudy") as string,
                startDate: new Date(formData.get("startDate") as string),
                endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
                isOngoing: formData.get("isOngoing") === "on",
                gpa: formData.get("gpa") as string,
                description: formData.get("description") as string,
              });
              setIsEduOpen(false);
              toast.success("Education record saved!");
            } catch (err: any) {
              toast.error(err.message || "Failed to save education");
            }
          }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edu-inst">Institution Name</Label>
                <Input id="edu-inst" name="institutionName" defaultValue={editEdu.institutionName || ""} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edu-degree">Degree / Qualification</Label>
                <Input id="edu-degree" name="degree" defaultValue={editEdu.degree || ""} required placeholder="e.g. BSc in Computer Science" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edu-field">Field of Study</Label>
                <Input id="edu-field" name="fieldOfStudy" defaultValue={editEdu.fieldOfStudy || ""} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edu-gpa">Grade / GPA</Label>
                <Input id="edu-gpa" name="gpa" defaultValue={editEdu.gpa || ""} placeholder="e.g. 3.8 / 4.0" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edu-start">Start Date</Label>
                <Input id="edu-start" name="startDate" type="date" defaultValue={editEdu.startDate ? new Date(editEdu.startDate).toISOString().split("T")[0] : ""} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edu-end">End Date</Label>
                <Input id="edu-end" name="endDate" type="date" defaultValue={editEdu.endDate ? new Date(editEdu.endDate).toISOString().split("T")[0] : ""} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edu-ongoing" name="isOngoing" defaultChecked={editEdu.isOngoing || false} />
              <Label htmlFor="edu-ongoing" className="cursor-pointer">Currently ongoing study</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edu-desc">Description</Label>
              <Textarea id="edu-desc" name="description" defaultValue={editEdu.description || ""} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Skill Dialog */}
      <Dialog open={isSkillOpen} onOpenChange={setIsSkillOpen}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await addSkill({
                name: formData.get("name") as string,
                category: formData.get("category") as string,
                proficiency: formData.get("proficiency") as string,
              });
              setIsSkillOpen(false);
              toast.success("Skill added!");
            } catch (err: any) {
              toast.error(err.message || "Failed to add skill");
            }
          }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="skill-name">Skill Name</Label>
              <Input id="skill-name" name="name" required placeholder="e.g. Next.js" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="skill-cat">Category</Label>
              <select id="skill-cat" name="category" className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm">
                <option value="Technical">Technical Skills</option>
                <option value="Soft">Soft Skills</option>
                <option value="Tools">Tools & Software</option>
                <option value="Languages">Languages</option>
                <option value="Knowledge">Industry Knowledge</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="skill-prof">Proficiency</Label>
              <select id="skill-prof" name="proficiency" className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm">
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={isProjOpen} onOpenChange={setIsProjOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>{editProj.id ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveProject({
                id: editProj.id,
                title: formData.get("title") as string,
                projectType: formData.get("projectType") as string,
                description: formData.get("description") as string,
                role: formData.get("role") as string,
                tools: (formData.get("tools") as string).split(",").map(s => s.trim()).filter(Boolean),
                outcome: formData.get("outcome") as string,
                projectUrl: formData.get("projectUrl") as string,
                githubUrl: formData.get("githubUrl") as string,
                demoVideoUrl: "",
              });
              setIsProjOpen(false);
              toast.success("Project saved!");
            } catch (err: any) {
              toast.error(err.message || "Failed to save project");
            }
          }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="proj-title">Project Title</Label>
                <Input id="proj-title" name="title" defaultValue={editProj.title || ""} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proj-type">Project Type</Label>
                <select id="proj-type" name="projectType" defaultValue={editProj.projectType || "Personal"} className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm">
                  <option value="Personal">Personal Project</option>
                  <option value="Academic">Academic Project</option>
                  <option value="Professional">Professional Work</option>
                  <option value="Freelance">Freelance Contract</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="proj-role">Your Role</Label>
                <Input id="proj-role" name="role" defaultValue={editProj.role || ""} placeholder="e.g. Lead Frontend Developer" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proj-tools">Tools (comma separated)</Label>
                <Input id="proj-tools" name="tools" defaultValue={editProj.tools ? (editProj.tools as string[]).join(", ") : ""} placeholder="e.g. React, PostgreSQL, Tailwind" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea id="proj-desc" name="description" defaultValue={editProj.description || ""} rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="proj-link">Live Link</Label>
                <Input id="proj-link" name="projectUrl" defaultValue={editProj.projectUrl || ""} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proj-git">GitHub URL</Label>
                <Input id="proj-git" name="githubUrl" defaultValue={editProj.githubUrl || ""} placeholder="https://github.com/..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Services Dialog */}
      <Dialog open={isServOpen} onOpenChange={setIsServOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Freelance Service Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveService({
                id: editServ.id,
                title: formData.get("title") as string,
                pricing: formData.get("pricing") as string,
                description: formData.get("description") as string,
                category: "",
                deliveryTime: "",
              });
              setIsServOpen(false);
              toast.success("Service record updated!");
            } catch (err: any) {
              toast.error("Failed to save service");
            }
          }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="serv-title">Service Name</Label>
              <Input id="serv-title" name="title" defaultValue={editServ.title || ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="serv-price">Starting Price Label</Label>
              <Input id="serv-price" name="pricing" defaultValue={editServ.pricing || ""} placeholder="e.g. LKR 10,000 / project" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="serv-desc">Description</Label>
              <Textarea id="serv-desc" name="description" defaultValue={editServ.description || ""} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Certifications Dialog */}
      <Dialog open={isCertOpen} onOpenChange={setIsCertOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Certification Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveCertification({
                id: editCert.id,
                name: formData.get("name") as string,
                issuingOrg: formData.get("issuingOrg") as string,
                issueDate: null,
                expiryDate: null,
                credentialId: formData.get("credentialId") as string,
                credentialUrl: formData.get("credentialUrl") as string,
              });
              setIsCertOpen(false);
              toast.success("Certification saved!");
            } catch (err: any) {
              toast.error("Failed to save certification");
            }
          }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cert-name">Certification Name</Label>
              <Input id="cert-name" name="name" defaultValue={editCert.name || ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cert-org">Issuing Organization</Label>
              <Input id="cert-org" name="issuingOrg" defaultValue={editCert.issuingOrg || ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cert-cred-id">Credential ID</Label>
              <Input id="cert-cred-id" name="credentialId" defaultValue={editCert.credentialId || ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cert-cred-url">Credential Verification URL</Label>
              <Input id="cert-cred-url" name="credentialUrl" defaultValue={editCert.credentialUrl || ""} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Awards Dialog */}
      <Dialog open={isAwardOpen} onOpenChange={setIsAwardOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Award Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await saveAward({
                id: editAward.id,
                title: formData.get("title") as string,
                issuer: formData.get("issuer") as string,
                description: formData.get("description") as string,
                dateReceived: null,
              });
              setIsAwardOpen(false);
              toast.success("Award saved!");
            } catch (err: any) {
              toast.error("Failed to save award");
            }
          }} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="award-title">Award Title</Label>
              <Input id="award-title" name="title" defaultValue={editAward.title || ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="award-issuer">Issuing Entity</Label>
              <Input id="award-issuer" name="issuer" defaultValue={editAward.issuer || ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="award-desc">Description</Label>
              <Textarea id="award-desc" name="description" defaultValue={editAward.description || ""} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-teal-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
