import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Search, FileText, CheckCircle, XCircle, ArrowRight, User, Globe, Edit3, MessageSquare, AlertCircle, Sparkles, ShieldAlert, Lock, Unlock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateTalentProfile, respondToContactRequest } from "@/server/actions/talent";

type TalentPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return {
    title: "Talent Profile Dashboard - Career Studio",
    description: "Manage your professional career profile and respond to recruiter contact inquiries.",
  };
}

export default async function TalentPage({ params }: TalentPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  // Get profile
  const profile = await getOrCreateTalentProfile(session.user.id);

  // Fetch contact requests
  const contactRequests = await prisma.talentContactRequest.findMany({
    where: { talentProfileId: profile.id },
    include: {
      recruiter: {
        select: {
          firstName: true,
          lastName: true,
          image: true,
          email: true,
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Fetch blocked companies
  const blocks = await prisma.candidateBlock.findMany({
    where: { talentProfileId: profile.id },
    include: { company: true }
  });

  // Fetch all companies to populate the blocklist dropdown
  const allCompanies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  // Calculate missing elements to show as recommendations
  const tips = [];
  if (!profile.profileImage) tips.push({ text: "Add a profile picture to make your profile trustworthy.", tab: "about" });
  if (!profile.coverImage) tips.push({ text: "Upload a cover banner to stand out visually.", tab: "about" });
  if (!profile.bio || profile.bio.length < 50) tips.push({ text: "Write a detailed bio summary (or use AI generation).", tab: "about" });
  if (profile.experiences.length === 0) tips.push({ text: "Add at least one professional work experience record.", tab: "experience" });
  if (profile.educations.length === 0) tips.push({ text: "Add your educational background or degrees.", tab: "education" });
  if (profile.skills.length < 3) tips.push({ text: "List at least 3 skills to show in searches.", tab: "skills" });
  if (profile.projects.length === 0) tips.push({ text: "Showcase a project to highlight your practical skills.", tab: "projects" });
  if (!profile.cvPath) tips.push({ text: "Upload your CV/Resume PDF for recruiters to download.", tab: "cv" });

  const pendingRequests = contactRequests.filter(r => r.status === "pending");
  const acceptedRequests = contactRequests.filter(r => r.status === "accepted");

  // Server Action handlers
  const handleRequestResponse = async (formData: FormData) => {
    "use server";
    const requestId = formData.get("requestId") as string;
    const status = formData.get("status") as "accepted" | "declined";
    if (requestId && status) {
      await respondToContactRequest(requestId, status);
    }
  };

  const handleBlockCompany = async (formData: FormData) => {
    "use server";
    const companyId = formData.get("companyId") as string;
    if (companyId) {
      try {
        await prisma.candidateBlock.create({
          data: { talentProfileId: profile.id, companyId }
        });
      } catch (e) {
        // Ignore unique constraint errors
      }
    }
  };

  const handleRemoveBlock = async (formData: FormData) => {
    "use server";
    const blockId = formData.get("blockId") as string;
    if (blockId) {
      await prisma.candidateBlock.delete({ where: { id: blockId } });
    }
  };
  
  const handleVisibilityChange = async (formData: FormData) => {
    "use server";
    const visibility = formData.get("visibility") as string;
    if (visibility) {
      await prisma.talentProfile.update({
        where: { id: profile.id },
        data: { visibility }
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Upper Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Talent Dashboard</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Showcase your skills to verified recruiters. Customize your privacy and share your public profile link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {profile.customSlug && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/${locale}/talent/${profile.customSlug}`} target="_blank">
                <Globe className="size-4 text-neutral-600" />
                <span>View Public Profile</span>
              </Link>
            </Button>
          )}
          <Button asChild className="bg-teal-700 hover:bg-teal-800 text-white gap-2" size="sm">
            <Link href={`/${locale}/talent/edit`}>
              <Edit3 className="size-4" />
              <span>Edit Career Profile</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Profile Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Profile Strength</p>
              <h3 className="text-3xl font-bold text-neutral-900 mt-1">{profile.completionScore}%</h3>
            </div>
            <div className="relative size-14">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-neutral-100"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-teal-600"
                  strokeWidth="3.5"
                  strokeDasharray={`${profile.completionScore}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-teal-900">
                {profile.completionScore}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Profile Views</p>
              <h3 className="text-3xl font-bold text-neutral-900 mt-1">{profile.views}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-800 rounded-2xl">
              <Eye className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Search Appearances</p>
              <h3 className="text-3xl font-bold text-neutral-900 mt-1">{profile.searchAppearances}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-800 rounded-2xl">
              <Search className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Inquiries Received</p>
              <h3 className="text-3xl font-bold text-neutral-900 mt-1">{contactRequests.length}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-800 rounded-2xl">
              <MessageSquare className="size-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Content Column */}
        <div className="space-y-6">
          <Card className="bg-white border shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Recruiter Contact Requests</CardTitle>
              <CardDescription>
                Hiring managers can send you requests to reveal your phone/email and share your full resume.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-teal-100 bg-teal-50/20 p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-neutral-900">{req.jobTitle}</h4>
                        <p className="text-sm font-medium text-neutral-600 mt-0.5">{req.companyName} • {req.jobLocation}</p>
                        {req.salaryRange && (
                          <Badge variant="secondary" className="mt-1 bg-white border">
                            Budget: {req.salaryRange}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(req.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {req.message && (
                      <div className="bg-white/80 p-3 rounded-lg border text-sm text-neutral-700 italic">
                        "{req.message}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-teal-100/50">
                      <p className="text-xs text-neutral-500">
                        Accepting will reveal your contact details & resume to this recruiter.
                      </p>
                      <form action={handleRequestResponse} className="flex gap-2">
                        <input type="hidden" name="requestId" value={req.id} />
                        <Button 
                          type="submit" 
                          name="status" 
                          value="declined" 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <XCircle className="size-4 mr-1.5" />
                          Decline
                        </Button>
                        <Button 
                          type="submit" 
                          name="status" 
                          value="accepted" 
                          size="sm" 
                          className="bg-teal-700 hover:bg-teal-800 text-white"
                        >
                          <CheckCircle className="size-4 mr-1.5" />
                          Accept
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-neutral-500 border border-dashed rounded-xl">
                  No pending recruiter inquiries at the moment.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Controls & Blocklist */}
          <Card className="bg-white border shadow-sm border-blue-100">
            <CardHeader className="bg-blue-50/50 border-b border-blue-50 pb-5">
              <CardTitle className="text-xl flex items-center gap-2 text-blue-900">
                <ShieldAlert className="size-5 text-blue-600" />
                Privacy & Safety Controls
              </CardTitle>
              <CardDescription className="text-blue-700/80">
                Control who can see your profile on the marketplace and block specific companies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              
              {/* Visibility Setting */}
              <div className="space-y-3">
                <h3 className="font-semibold text-neutral-900 text-sm">Profile Visibility</h3>
                <form action={handleVisibilityChange} className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <select 
                    name="visibility" 
                    defaultValue={profile.visibility}
                    className="flex h-10 w-full sm:w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  >
                    <option value="public">Public (Visible to everyone)</option>
                    <option value="recruiters_only">Recruiters Only (Hidden from Google/Public)</option>
                    <option value="private">Private (Hidden from marketplace)</option>
                  </select>
                  <Button type="submit" size="sm" variant="outline" className="shrink-0 gap-2 text-blue-700 border-blue-200 hover:bg-blue-50">
                    <CheckCircle className="size-3.5" /> Save Visibility
                  </Button>
                </form>
                {profile.visibility === "private" && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-200 mt-2">
                    <Lock className="size-3.5" /> Your profile is hidden from the marketplace. Recruiters cannot find you.
                  </div>
                )}
              </div>

              {/* Company Blocklist */}
              <div className="space-y-4 pt-6 border-t border-neutral-100">
                <div className="space-y-1">
                  <h3 className="font-semibold text-neutral-900 text-sm">Company Blocklist</h3>
                  <p className="text-xs text-neutral-500">
                    Hide your profile completely from specific employers (e.g., your current workplace).
                  </p>
                </div>
                
                <form action={handleBlockCompany} className="flex gap-3">
                  <select 
                    name="companyId" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    required
                  >
                    <option value="">Select a company to block...</option>
                    {allCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Button type="submit" className="bg-neutral-800 hover:bg-neutral-900 text-white shrink-0">
                    Block Company
                  </Button>
                </form>

                {blocks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {blocks.map(block => (
                      <div key={block.id} className="flex items-center gap-2 bg-neutral-100 border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-full text-sm font-medium">
                        <ShieldAlert className="size-3.5 text-neutral-500" />
                        {block.company.name}
                        <form action={handleRemoveBlock} className="flex">
                          <input type="hidden" name="blockId" value={block.id} />
                          <button type="submit" className="ml-1 text-neutral-400 hover:text-red-600 transition-colors">
                            <XCircle className="size-4" />
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Accepted / Previous Inquiries */}
          {acceptedRequests.length > 0 && (
            <Card className="bg-white border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Accepted Introductions</CardTitle>
                <CardDescription>Recruiters who have access to your full details.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {acceptedRequests.map((req) => (
                  <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-neutral-800 text-sm">{req.jobTitle}</h4>
                      <p className="text-xs text-neutral-600">{req.companyName} • {req.jobLocation}</p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Accepted on {new Date(req.updatedAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-850 gap-1 text-xs">
                      <Unlock className="size-3" />
                      Connected
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Tips Panel */}
        <aside className="space-y-6">
          <Card className="bg-gradient-to-br from-teal-900 to-teal-950 text-white border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="size-5 text-teal-300" />
                Improve Profile
              </CardTitle>
              <CardDescription className="text-teal-200">
                Complete these suggestions to reach 100% profile score and get 4x more views.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tips.length > 0 ? (
                tips.map((tip, idx) => (
                  <Link 
                    href={`/${locale}/talent/edit`} 
                    key={idx} 
                    className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/10 transition-colors text-xs text-teal-50"
                  >
                    <AlertCircle className="size-4 shrink-0 text-teal-300 mt-0.5" />
                    <span className="flex-1 leading-normal">{tip.text}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-teal-400 mt-0.5" />
                  </Link>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-teal-200 font-medium">
                  🎉 Your profile is 100% complete and fully optimized!
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
