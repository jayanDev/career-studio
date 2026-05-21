"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Building2, Globe, MapPin, Users, HeartHandshake, Briefcase, Mail, CheckCircle2 } from "lucide-react";
import type { RecruiterProfile } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRecruiterProfile } from "@/server/actions/recruiter";
import { Badge } from "@/components/ui/badge";

interface CompanyProfileFormProps {
  initialProfile: RecruiterProfile | null;
  locale: string;
}

export function CompanyProfileForm({ initialProfile, locale }: CompanyProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialProfile?.title || "",
    workEmail: initialProfile?.workEmail || "",
    companyName: initialProfile?.companyName || "",
    websiteUrl: initialProfile?.websiteUrl || "",
    industry: initialProfile?.industry || "",
    companySize: initialProfile?.companySize || "",
    location: initialProfile?.location || "",
    about: initialProfile?.about || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      toast.error("Company Name is required.");
      return;
    }

    setIsLoading(true);
    try {
      await saveRecruiterProfile({
        ...formData,
        companyLogo: initialProfile?.companyLogo || null,
      });
      toast.success("Recruiter profile saved successfully!");
      router.push(`/${locale}/talent-pool`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save recruiter details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      
      {/* Recruiter Details */}
      <Card className="bg-white/70 backdrop-blur-xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-neutral-100 bg-gradient-to-r from-teal-50/60 to-emerald-50/60 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-teal-950 flex items-center gap-2">
                <Briefcase className="size-5 text-teal-600" />
                Your Identity
              </CardTitle>
              <CardDescription className="text-teal-800/70 mt-1.5">
                How candidates will see you when you reach out.
              </CardDescription>
            </div>
            {initialProfile?.isVerified && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200/60 flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="size-3.5" /> Verified Recruiter
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2.5 group">
              <Label htmlFor="title" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-teal-700">
                <span>Job Title <span className="text-red-500">*</span></span>
              </Label>
              <Input 
                id="title" 
                required 
                placeholder="e.g. Senior Talent Acquisition Specialist" 
                className="h-11 bg-white/60 border-neutral-200/80 focus:border-teal-500 focus:ring-teal-500/20 transition-all rounded-xl shadow-sm"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2.5 group">
              <Label htmlFor="workEmail" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-teal-700">
                <span>Work Email <span className="text-red-500">*</span></span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 group-focus-within:text-teal-600 transition-colors" />
                <Input 
                  id="workEmail" 
                  type="email"
                  required 
                  placeholder="you@company.lk" 
                  className="h-11 pl-9 bg-white/60 border-neutral-200/80 focus:border-teal-500 focus:ring-teal-500/20 transition-all rounded-xl shadow-sm"
                  value={formData.workEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, workEmail: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card className="bg-white/70 backdrop-blur-xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-neutral-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 pb-6">
          <CardTitle className="text-xl font-semibold text-blue-950 flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" />
            Company Profile
          </CardTitle>
          <CardDescription className="text-blue-800/70 mt-1.5">
            Build your employer brand. Candidates are more likely to respond to fully completed profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2.5 group">
              <Label htmlFor="companyName" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">
                <span>Company Name <span className="text-red-500">*</span></span>
              </Label>
              <Input 
                id="companyName" 
                required 
                placeholder="e.g. Creative Software Solutions" 
                className="h-11 bg-white/60 border-neutral-200/80 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-xl shadow-sm"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              />
            </div>

            <div className="space-y-2.5 group">
              <Label htmlFor="websiteUrl" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">
                <span>Website URL</span>
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 group-focus-within:text-blue-600 transition-colors" />
                <Input 
                  id="websiteUrl" 
                  placeholder="https://company.lk" 
                  className="h-11 pl-9 bg-white/60 border-neutral-200/80 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-xl shadow-sm"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-2.5 group">
              <Label htmlFor="industry" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">
                <HeartHandshake className="size-4 text-blue-600/70" />
                <span>Industry</span>
              </Label>
              <Input 
                id="industry" 
                placeholder="e.g. Information Technology" 
                className="h-11 bg-white/60 border-neutral-200/80 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-xl shadow-sm"
                value={formData.industry}
                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
              />
            </div>

            <div className="space-y-2.5 group">
              <Label htmlFor="location" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">
                <MapPin className="size-4 text-blue-600/70" />
                <span>Office Location</span>
              </Label>
              <Input 
                id="location" 
                placeholder="e.g. Colombo 03, Sri Lanka" 
                className="h-11 bg-white/60 border-neutral-200/80 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-xl shadow-sm"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <div className="space-y-2.5 group">
              <Label htmlFor="companySize" className="flex items-center gap-2 text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">
                <Users className="size-4 text-blue-600/70" />
                <span>Company Size</span>
              </Label>
              <select
                id="companySize"
                className="flex h-11 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 hover:border-blue-300"
                value={formData.companySize}
                onChange={(e) => setFormData(prev => ({ ...prev, companySize: e.target.value }))}
              >
                <option value="">Select size...</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 group">
            <Label htmlFor="about" className="text-neutral-600 font-medium transition-colors group-focus-within:text-blue-700">About the Company / Pitch</Label>
            <Textarea 
              id="about" 
              placeholder="Describe your company, typical tech stacks, team culture, and hiring vision..." 
              rows={5}
              className="bg-white/60 border-neutral-200/80 focus:border-blue-500 focus:ring-blue-500/20 transition-all resize-none rounded-xl shadow-sm"
              value={formData.about}
              onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
            />
          </div>

          <div className="flex justify-end pt-8">
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 gap-2 px-8 h-12 rounded-xl text-base"
            >
              <Save className="size-5" />
              <span className="font-medium">{isLoading ? "Saving Profile..." : "Save & Continue"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
