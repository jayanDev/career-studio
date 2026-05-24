"use client";

// User-uploaded avatars and cover images come from arbitrary remote
// URLs without known dimensions. Wrapping them in next/image would
// require width/height props or fill mode + remote-image config in
// next.config.ts. For the public profile we keep <img> intentionally.
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Briefcase, CheckCircle, ShieldCheck, Mail, Phone, MapPin,
  Sparkles, FileText, Send, Star, Bookmark, BookmarkCheck, ExternalLink
} from "lucide-react";
import type { 
  TalentProfile, TalentExperience, TalentEducation, 
  TalentSkill, TalentProject, TalentService, 
  TalentPortfolio, TalentCertification, TalentAward, RecruiterProfile 
} from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { sendContactRequest, toggleShortlist, generateOutreachDraftAction } from "@/server/actions/recruiter";

interface PublicProfileClientProps {
  profile: TalentProfile & {
    experiences: TalentExperience[];
    educations: TalentEducation[];
    skills: TalentSkill[];
    projects: TalentProject[];
    services: TalentService[];
    portfolios: TalentPortfolio[];
    certifications: TalentCertification[];
    awards: TalentAward[];
    user: {
      firstName: string;
      lastName: string;
      image: string | null;
      email: string;
    };
  };
  recruiterProfile: RecruiterProfile | null;
  initialShortlisted: boolean;
  contactRequestStatus: "pending" | "accepted" | "declined" | "none";
  isOwner: boolean;
  locale: string;
  isAnonymousView?: boolean;
}

export function PublicProfileClient({
  profile,
  recruiterProfile,
  initialShortlisted,
  contactRequestStatus: initialRequestStatus,
  isOwner,
  locale,
  isAnonymousView
}: PublicProfileClientProps) {
  const [isShortlisted, setIsShortlisted] = useState(initialShortlisted);
  const [requestStatus, setRequestStatus] = useState(initialRequestStatus);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    jobTitle: "",
    companyName: recruiterProfile?.companyName || "",
    jobLocation: recruiterProfile?.location || "",
    salaryRange: "",
    message: "",
  });

  const handleToggleShortlist = async () => {
    if (!recruiterProfile) {
      toast.error("You must sign in as a verified Recruiter to shortlist candidates.");
      return;
    }
    try {
      const res = await toggleShortlist(profile.id);
      setIsShortlisted(res.shortlisted);
      toast.success(res.shortlisted ? "Candidate added to shortlist folder!" : "Removed from shortlist.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update shortlist.");
    }
  };

  const handleSendContactRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recruiterProfile) {
      toast.error("You must sign in as a recruiter to make contact requests.");
      return;
    }
    if (!formData.jobTitle || !formData.companyName) {
      toast.error("Job Title and Company Name are required.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await sendContactRequest({
        talentProfileId: profile.id,
        ...formData
      });
      setRequestStatus("pending");
      setIsContactDialogOpen(false);
      toast.success("Contact request sent successfully! The candidate will be notified.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!formData.jobTitle || !formData.companyName) {
      toast.error("Please enter a Job Title and Company Name for context.");
      return;
    }
    setIsGeneratingDraft(true);
    try {
      const draft = await generateOutreachDraftAction({
        talentProfileId: profile.id,
        jobTitle: formData.jobTitle,
        companyName: formData.companyName,
        jobLocation: formData.jobLocation,
        salaryRange: formData.salaryRange,
      });
      setFormData(prev => ({ ...prev, message: draft }));
      toast.success("AI draft generated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI draft.");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Determine which contact details to show
  const showContactDetails = isOwner || requestStatus === "accepted" || profile.isEmailPublic || profile.isPhonePublic;

  return (
    <div className="space-y-6">
      {isAnonymousView && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <ShieldCheck className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-amber-900">Anonymized Profile View</h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              To protect candidate privacy, the full last name, contact details, and resume files are hidden. You must send an Introduction Inquiry and have it accepted by the candidate to reveal this information.
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Profile Columns */}
      <div className="space-y-6">
        {/* Cover & Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* Cover Image Banner */}
          <div className="h-44 w-full bg-gradient-to-r from-teal-800 via-teal-950 to-neutral-900 relative">
            {profile.coverImage && (
              <img src={profile.coverImage} alt="Cover banner" className="size-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/10" />
          </div>

          <div className="px-6 pb-6 pt-0 relative">
            {/* Overlapping Avatar */}
            <div className="-mt-16 mb-4 relative z-10 flex size-28 items-center justify-center rounded-full bg-white p-1 shadow-md">
              <div className="relative size-full items-center justify-center rounded-full bg-teal-50 text-teal-800 font-bold text-3xl flex overflow-hidden">
                {profile.profileImage ? (
                  <img src={profile.profileImage} alt={profile.headline} className="size-full object-cover" />
                ) : (
                  `${profile.user.firstName[0] || ""}${profile.user.lastName[0] || ""}`
                )}
              </div>
            </div>

            {/* Candidate Identity */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                  <span>{profile.user.firstName} {profile.user.lastName}</span>
                  {profile.isVerified && (
                    <span title="Verified Professional">
                      <ShieldCheck className="size-5 text-teal-600 fill-teal-50" />
                    </span>
                  )}
                </h1>
                <p className="text-md font-medium text-neutral-700 mt-1">{profile.headline || "Talent Pool Candidate"}</p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-sm text-neutral-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4 text-neutral-400" />
                    {profile.city && profile.country ? `${profile.city}, ${profile.country}` : "Sri Lanka"}
                  </span>
                  <span>•</span>
                  <span>{profile.industry || "General Industry"}</span>
                  {profile.careerLevel && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{profile.careerLevel} Level</span>
                    </>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.isOpenToWork && (
                    <Badge className="bg-teal-700 hover:bg-teal-800 text-white font-medium">Open to Opportunities</Badge>
                  )}
                  {profile.availabilityDate && (
                    <Badge variant="outline" className="border-teal-200 text-teal-800">
                      Available from {new Date(profile.availabilityDate).toLocaleDateString(locale, { month: "short", year: "numeric" })}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {recruiterProfile && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleToggleShortlist} 
                    className={`gap-1.5 ${isShortlisted ? "border-amber-200 bg-amber-50 text-amber-900" : ""}`}
                  >
                    {isShortlisted ? <BookmarkCheck className="size-4 text-amber-700" /> : <Bookmark className="size-4" />}
                    <span>{isShortlisted ? "Shortlisted" : "Shortlist"}</span>
                  </Button>
                )}

                {isOwner ? (
                  <Button variant="secondary" size="sm" className="bg-neutral-100 text-neutral-800" disabled>
                    Viewing own profile
                  </Button>
                ) : requestStatus === "accepted" ? (
                  <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-850 py-1.5 px-3 gap-1 text-sm">
                    <CheckCircle className="size-4 text-teal-700" />
                    Connected
                  </Badge>
                ) : requestStatus === "pending" ? (
                  <Button variant="outline" size="sm" disabled className="border-amber-200 bg-amber-50 text-amber-800">
                    Inquiry Pending
                  </Button>
                ) : recruiterProfile ? (
                  <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-teal-700 hover:bg-teal-800 text-white gap-1.5" size="sm">
                        <Mail className="size-4" />
                        <span>Request Contact</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md bg-white">
                      <form onSubmit={handleSendContactRequest}>
                        <DialogHeader>
                          <DialogTitle>Send Introduction Inquiry</DialogTitle>
                          <DialogDescription>
                            Briefly outline the job role and message. Once the candidate accepts, their CV and direct contact info will be unlocked.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="jobTitle">Job Opportunity Title</Label>
                            <Input 
                              id="jobTitle" 
                              required 
                              placeholder="e.g. Senior Software Engineer" 
                              value={formData.jobTitle}
                              onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input 
                              id="companyName" 
                              required 
                              placeholder="e.g. Acme Lanka Corp" 
                              value={formData.companyName}
                              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="jobLocation">Job Location</Label>
                              <Input 
                                id="jobLocation" 
                                placeholder="e.g. Colombo (Hybrid)" 
                                value={formData.jobLocation}
                                onChange={(e) => setFormData(prev => ({ ...prev, jobLocation: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="salaryRange">Salary Range / Budget</Label>
                              <Input 
                                id="salaryRange" 
                                placeholder="e.g. 200,000 - 300,000 LKR" 
                                value={formData.salaryRange}
                                onChange={(e) => setFormData(prev => ({ ...prev, salaryRange: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="message">Message to Candidate</Label>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleGenerateDraft}
                                disabled={isGeneratingDraft}
                                className="h-7 text-xs bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 gap-1"
                              >
                                <Sparkles className="size-3" />
                                {isGeneratingDraft ? "Drafting..." : "AI Draft"}
                              </Button>
                            </div>
                            <Textarea 
                              id="message" 
                              placeholder="Introduce your team, project details or any specific instructions..." 
                              rows={5}
                              value={formData.message}
                              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="ghost" onClick={() => setIsContactDialogOpen(false)}>Cancel</Button>
                          <Button type="submit" disabled={isSubmittingRequest} className="bg-teal-700 text-white hover:bg-teal-800 gap-1.5">
                            <Send className="size-4" />
                            <span>Send Request</span>
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button asChild size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
                    <a href={`/${locale}/auth/sign-in`}>Sign in to Contact</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        {profile.bio && (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">About & Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Experience Timeline */}
        {profile.experiences.length > 0 && (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Professional Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="relative flex gap-4 first:pt-0 pt-6 border-t first:border-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <Briefcase className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-neutral-900">{exp.title}</h4>
                    <p className="text-sm font-medium text-neutral-600">{exp.companyName} • {exp.location}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(exp.startDate).toLocaleDateString(locale, { month: "short", year: "numeric" })} - {" "}
                      {exp.isCurrent ? "Present" : exp.endDate ? new Date(exp.endDate).toLocaleDateString(locale, { month: "short", year: "numeric" }) : ""}
                    </p>
                    {exp.description && (
                      <p className="mt-2 text-sm text-neutral-600 whitespace-pre-wrap">{exp.description}</p>
                    )}
                    {exp.skillsUsed && (exp.skillsUsed as string[]).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(exp.skillsUsed as string[]).map(skill => (
                          <Badge key={skill} variant="outline" className="text-[10px] bg-slate-50">{skill}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Education History */}
        {profile.educations.length > 0 && (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.educations.map((edu) => (
                <div key={edu.id} className="flex gap-4 first:pt-0 pt-6 border-t first:border-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900">{edu.degree}</h4>
                    <p className="text-sm font-medium text-neutral-600">{edu.institutionName} {edu.fieldOfStudy && `• ${edu.fieldOfStudy}`}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(edu.startDate).getFullYear()} - {edu.isOngoing ? "Ongoing" : edu.endDate ? new Date(edu.endDate).getFullYear() : ""}
                    </p>
                    {edu.gpa && <p className="mt-1 text-xs font-semibold text-teal-700">GPA: {edu.gpa}</p>}
                    {edu.description && <p className="mt-2 text-sm text-neutral-600">{edu.description}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Projects Showcase */}
        {profile.projects.length > 0 && (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Key Projects</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {profile.projects.map((proj) => (
                <div key={proj.id} className="rounded-xl border p-4 flex flex-col justify-between hover:shadow-sm transition-all bg-card">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-neutral-900">{proj.title}</h4>
                      <Badge variant="secondary" className="text-[10px]">{proj.projectType}</Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{proj.role}</p>
                    <p className="text-sm text-neutral-600 mt-2 line-clamp-3">{proj.description}</p>
                    {proj.outcome && (
                      <p className="text-xs font-medium text-teal-800 mt-2">Outcome: {proj.outcome}</p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                    {proj.projectUrl && (
                      <a href={proj.projectUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-teal-700 font-semibold hover:underline">
                        <span>Demo</span>
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {proj.githubUrl && (
                      <a href={proj.githubUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-teal-700 font-semibold hover:underline">
                        <span>Codebase</span>
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Services & Portfolios */}
        {profile.services.length > 0 && (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Consultancy & Services</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {profile.services.map((serv) => (
                <div key={serv.id} className="rounded-xl border p-4 bg-slate-50/50">
                  <h4 className="font-semibold text-neutral-950 text-sm">{serv.title}</h4>
                  {serv.pricing && <p className="text-xs text-teal-850 font-bold mt-1">Pricing: {serv.pricing}</p>}
                  <p className="text-xs text-neutral-600 mt-2">{serv.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar Panels */}
      <div className="space-y-6">
        {/* Contact Info Card */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-md">Contact & Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showContactDetails ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="size-4.5 text-teal-700 shrink-0" />
                  <a href={`mailto:${profile.user.email}`} className="text-neutral-800 hover:underline break-all">
                    {profile.user.email}
                  </a>
                </div>
                {profile.user.email !== profile.user.email && (
                  <div className="flex items-center gap-3 text-sm text-neutral-500">
                    <span className="size-4.5" />
                    <span>Inquiry Approved</span>
                  </div>
                )}
                {/* Simulated direct details if any details present */}
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="size-4.5 text-teal-700 shrink-0" />
                  <span className="text-neutral-800">+94 77 123 4567</span>
                </div>
                {profile.cvPath && (
                  <Button asChild className="w-full bg-teal-700 hover:bg-teal-800 text-white mt-2 text-xs">
                    <a href={profile.cvPath} download={profile.cvFilename || "Resume.pdf"}>
                      <FileText className="size-4 mr-1.5" />
                      Download Resume CV
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-neutral-50 p-4 border border-dashed text-center">
                  <Mail className="size-6 text-neutral-400 mx-auto mb-2" />
                  <h5 className="font-semibold text-xs text-neutral-800">Contact Details Masked</h5>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Send a connection or contact request to reveal email, phone number, and resume files.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Panel */}
        {profile.skills.length > 0 && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-md">Skills & Toolkit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Top/Featured Skills */}
              {profile.skills.filter(s => s.isTop).length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Top Skills</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.filter(s => s.isTop).map(skill => (
                      <Badge key={skill.name} className="bg-teal-700 text-white text-xs">
                        <Star className="size-3 fill-white mr-1" />
                        {skill.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Skills */}
              <div className="space-y-2 pt-2 border-t">
                <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">All Competencies</h5>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map(skill => (
                    <Badge key={skill.name} variant="outline" className="text-xs border-slate-200">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certifications and Awards */}
        {profile.certifications.length > 0 && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-md">Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.certifications.map(cert => (
                <div key={cert.id} className="text-xs space-y-1">
                  <h5 className="font-semibold text-neutral-900">{cert.name}</h5>
                  <p className="text-neutral-500">{cert.issuingOrg}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
