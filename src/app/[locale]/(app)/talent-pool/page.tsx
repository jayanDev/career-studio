import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, MapPin, ShieldCheck, Briefcase, Bookmark, Filter, ChevronRight, Clock, GraduationCap, Code2, TextSearch, BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slCertifications, slCompanies, slDistricts, slUniversities } from "@/lib/sl-data";
import { publicCandidateName, recruiterPlans, slIndustrySearchPacks } from "@/lib/talent-pool";
import { searchTalentPool } from "@/server/actions/recruiter";
import { SaveSearchButton } from "@/components/talent-pool/SaveSearchButton";

type TalentPoolPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  void params;
  return {
    title: "Find Top Talent - Career Studio Marketplace",
    description: "Search and discover verified candidates, engineers, designers and specialists in Sri Lanka.",
  };
}

export default async function TalentPoolPage({ params, searchParams }: TalentPoolPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();
  const queryObj = await searchParams;

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  // Check if current user has a recruiter profile
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  // If no recruiter profile exists, render the onboarding welcome page
  if (!recruiter) {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-800 shadow-sm border border-teal-200">
            <Briefcase className="size-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mt-4">Join as a Recruiter</h1>
          <p className="text-base text-neutral-600 max-w-md mx-auto leading-relaxed">
            Unlock the candidate marketplace to search profiles, save shortlists, and directly request developer/professional contacts.
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden rounded-2xl">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-5">
            <CardTitle className="text-lg text-neutral-900">Recruiter Onboarding</CardTitle>
            <CardDescription>Configure your hiring company details to get started.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 md:p-8 space-y-6 bg-white">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-teal-50 p-2 rounded-full mt-0.5">
                    <Search className="size-5 text-teal-600 shrink-0" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">Advanced Boolean Search</div>
                    <div className="text-sm text-neutral-600 mt-1">Search active candidates using Boolean operators (AND, OR), job titles, skills, and Sri Lankan district targeting.</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 p-2 rounded-full mt-0.5">
                    <Bookmark className="size-5 text-blue-600 shrink-0" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">Protected Shortlists & Pipelines</div>
                    <div className="text-sm text-neutral-600 mt-1">Save promising profiles into custom project pipelines (Kanban) and track candidates through stages.</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-purple-50 p-2 rounded-full mt-0.5">
                    <ShieldCheck className="size-5 text-purple-600 shrink-0" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">Recruiter-Safe Anonymity</div>
                    <div className="text-sm text-neutral-600 mt-1">Send contact requests securely. Candidates remain anonymous until they accept your request.</div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-neutral-100 flex justify-center">
                <Button asChild className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white w-full h-12 text-base rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all">
                  <Link href={`/${locale}/talent-pool/company`}>
                    Set Up Recruiter Identity
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse filters from URL query search parameters
  const queryStr = typeof queryObj.query === "string" ? queryObj.query : undefined;
  const title = typeof queryObj.title === "string" ? queryObj.title : undefined;
  const skill = typeof queryObj.skill === "string" ? queryObj.skill : undefined;
  const location = typeof queryObj.location === "string" ? queryObj.location : undefined;
  const careerLevel = typeof queryObj.careerLevel === "string" ? queryObj.careerLevel : undefined;
  const isOpenToWork = queryObj.isOpenToWork === "true" ? true : undefined;
  const verifiedOnly = queryObj.verifiedOnly === "true" ? true : undefined;
  const noticePeriod = typeof queryObj.noticePeriod === "string" ? queryObj.noticePeriod : undefined;
  const salaryMax = typeof queryObj.salaryMax === "string" && queryObj.salaryMax ? Number(queryObj.salaryMax) : undefined;
  const language = typeof queryObj.language === "string" ? queryObj.language : undefined;
  const openTo = typeof queryObj.openTo === "string" ? queryObj.openTo : undefined;
  const remote = queryObj.remote === "true" ? true : undefined;
  const company = typeof queryObj.company === "string" ? queryObj.company : undefined;
  const certification = typeof queryObj.certification === "string" ? queryObj.certification : undefined;
  const sort = typeof queryObj.sort === "string" ? queryObj.sort : undefined;
  const jdText = typeof queryObj.jdText === "string" ? queryObj.jdText : undefined;
  const pack = typeof queryObj.pack === "string" ? queryObj.pack : undefined;
  
  // Sri Lankan Moat parameters
  const district = typeof queryObj.district === "string" ? queryObj.district : undefined;
  const university = typeof queryObj.university === "string" ? queryObj.university : undefined;

  // Execute search
  const packQuery = slIndustrySearchPacks.find((item) => item.slug === pack)?.keywords.join(" OR ");
  const candidates = await searchTalentPool({
    query: queryStr,
    title,
    skill: skill || packQuery,
    location,
    careerLevel,
    isOpenToWork,
    verifiedOnly,
    district,
    university,
    noticePeriod,
    salaryMax,
    language,
    openTo,
    remote,
    company,
    certification,
    sort,
    jdText,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      {/* Header and Shortcuts */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 flex items-center gap-3">
            <span>Find Candidates</span>
            <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800 text-sm py-0.5">
              {candidates.length} Profiles
            </Badge>
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Hiring for <span className="font-medium text-neutral-900">{recruiter.companyName || "your company"}</span>. Use boolean logic to pinpoint exact profiles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2 border-neutral-200 hover:bg-neutral-50 rounded-lg">
            <Link href={`/${locale}/talent-pool/projects`}>
              <Briefcase className="size-4 text-blue-600" />
              <span className="font-medium">Pipelines</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2 border-neutral-200 hover:bg-neutral-50 rounded-lg">
            <Link href={`/${locale}/talent-pool/shortlist`}>
              <Bookmark className="size-4 text-purple-600" />
              <span className="font-medium">Shortlist</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2 border-neutral-200 hover:bg-neutral-50 rounded-lg">
            <Link href={`/${locale}/talent-pool/company`}>
              <ShieldCheck className="size-4 text-emerald-600" />
              <span className="font-medium">Company Identity</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2 border-neutral-200 hover:bg-neutral-50 rounded-lg">
            <Link href={`/${locale}/talent-pool/analytics`}>
              <BarChart3 className="size-4 text-orange-600" />
              <span className="font-medium">Analytics & Insights</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Recruiter verification status banner */}
      {!recruiter.isVerified && (
        <Card className="border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-amber-900">Verification Pending</h4>
              <p className="text-xs text-amber-800/80 mt-1 max-w-3xl leading-relaxed">
                Your recruiter profile is under review by our moderation team. You can explore the candidate database and create pipelines, but you cannot dispatch contact requests until verified.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {recruiterPlans.map((plan) => (
          <Card key={plan.slug} className={`bg-white ${plan.slug === "starter" ? "border-teal-200" : "border-neutral-200"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">{plan.name}</h2>
                  <p className="mt-1 text-xs text-neutral-500">{plan.credits === -1 ? "Unlimited" : plan.credits} credits / month</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {plan.priceLkr ? `Rs ${plan.priceLkr.toLocaleString("en-LK")}` : "Custom"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Primary Search Bar (Boolean/Keyword) */}
      <Card className="bg-white border shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <form method="GET" className="space-y-4">
            {/* Preserve other filters as hidden inputs if we wanted to... For simplicity we rely on the sidebar form overriding everything if submitted, or we can use JS to sync them. Here we just offer a quick search that resets advanced filters. */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <TextSearch className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-neutral-400" />
                <Input 
                  name="query" 
                  placeholder='Boolean Search: e.g. "React" AND "Node.js" OR "Python"' 
                  defaultValue={queryStr || ""}
                  className="h-14 pl-12 rounded-xl text-lg bg-neutral-50/50 border-neutral-200 focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
                />
              </div>
              <Button type="submit" className="h-14 px-8 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-medium text-base shrink-0 shadow-sm gap-2">
                <Search className="size-5" /> Search
              </Button>
            </div>
            <Textarea
              name="jdText"
              defaultValue={jdText || ""}
              rows={3}
              placeholder="Paste a JD to run AI Match ranking across visible candidates..."
              className="text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {slIndustrySearchPacks.map((item) => (
                <Button key={item.slug} asChild variant={pack === item.slug ? "default" : "outline"} size="sm" className={pack === item.slug ? "bg-teal-700 text-white" : ""}>
                  <Link href={`/${locale}/talent-pool?pack=${item.slug}`}>{item.name}</Link>
                </Button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] items-start">
        {/* Filters Sidebar */}
        <aside className="sticky top-6">
          <Card className="bg-white border shadow-sm rounded-xl">
            <CardHeader className="pb-4 border-b border-neutral-100 flex flex-row items-center justify-between bg-neutral-50/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-neutral-800">
                <Filter className="size-4" />
                Advanced Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                <SaveSearchButton />
                {(queryStr || title || skill || district || university || careerLevel || isOpenToWork || verifiedOnly) && (
                  <Button asChild variant="link" size="sm" className="text-xs text-neutral-500 hover:text-neutral-900 h-auto p-0 font-medium">
                    <Link href={`/${locale}/talent-pool`}>Clear all</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <form method="GET" className="p-5 space-y-6">
                {/* Keep current query in sync if sidebar is used */}
                {queryStr && <input type="hidden" name="query" value={queryStr} />}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Job Title</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                      <Input id="title" name="title" placeholder="e.g. Software Engineer" defaultValue={title || ""} className="h-10 pl-9 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skill" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Skill Requirement</Label>
                    <div className="relative">
                      <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                      <Input id="skill" name="skill" placeholder="e.g. Next.js, AWS" defaultValue={skill || ""} className="h-10 pl-9 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Sri Lanka District</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                      <select
                        id="district"
                        name="district"
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                        defaultValue={district || ""}
                      >
                        <option value="">All Island</option>
                        {slDistricts.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="university" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">University / Institute</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                      <Input id="university" name="university" list="sl-universities" placeholder="e.g. SLIIT, Moratuwa" defaultValue={university || ""} className="h-10 pl-9 text-sm rounded-lg" />
                      <datalist id="sl-universities">
                        {slUniversities.map((item) => <option key={item} value={item} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Current / Past Company</Label>
                    <Input id="company" name="company" list="sl-companies" placeholder="e.g. WSO2, MAS" defaultValue={company || ""} className="h-10 text-sm rounded-lg" />
                    <datalist id="sl-companies">
                      {slCompanies.map((item) => <option key={item} value={item} />)}
                    </datalist>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="certification" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Certification</Label>
                    <Input id="certification" name="certification" list="sl-certs" placeholder="e.g. CIMA, ACCA" defaultValue={certification || ""} className="h-10 text-sm rounded-lg" />
                    <datalist id="sl-certs">
                      {slCertifications.map((item) => <option key={item} value={item} />)}
                    </datalist>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="careerLevel" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Career Level</Label>
                    <select
                      id="careerLevel"
                      name="careerLevel"
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                      defaultValue={careerLevel || ""}
                    >
                      <option value="">Any Experience Level</option>
                      <option value="student">Student / Undergrad</option>
                      <option value="fresher">Fresher (0-1 yrs)</option>
                      <option value="junior">Junior (1-3 yrs)</option>
                      <option value="mid">Mid-Level (3-5 yrs)</option>
                      <option value="senior">Senior (5-8 yrs)</option>
                      <option value="lead">Lead / Staff (8+ yrs)</option>
                      <option value="executive">Executive / VP</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="noticePeriod" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Notice</Label>
                      <select id="noticePeriod" name="noticePeriod" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm" defaultValue={noticePeriod || ""}>
                        <option value="">Any</option>
                        <option value="2 weeks">≤2 weeks</option>
                        <option value="1 month">1 month</option>
                        <option value="2 months">2 months</option>
                        <option value="3 months">3 months</option>
                        <option value="negotiable">Negotiable</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salaryMax" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Max LKR</Label>
                      <Input id="salaryMax" name="salaryMax" type="number" placeholder="300000" defaultValue={salaryMax || ""} className="h-10 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="language" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Language</Label>
                      <select id="language" name="language" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm" defaultValue={language || ""}>
                        <option value="">Any</option>
                        <option value="Sinhala">Sinhala</option>
                        <option value="Tamil">Tamil</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openTo" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Open to</Label>
                      <select id="openTo" name="openTo" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm" defaultValue={openTo || ""}>
                        <option value="">Any</option>
                        <option value="full_time">Full-time</option>
                        <option value="contract">Contract</option>
                        <option value="internship">Internship</option>
                        <option value="freelance">Freelance</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sort" className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Sort by</Label>
                    <select id="sort" name="sort" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm" defaultValue={sort || ""}>
                      <option value="">Relevance</option>
                      <option value="confidence">Candidate confidence</option>
                      <option value="freshest">Freshest profile</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-5 border-t border-neutral-100">
                  <label className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="isOpenToWork" 
                      value="true" 
                      defaultChecked={isOpenToWork} 
                      className="size-4 rounded border-neutral-300 accent-teal-600 focus:ring-teal-500 transition-all" 
                    />
                    <span className="group-hover:text-neutral-900 transition-colors">Actively Open to Work</span>
                  </label>
                  <label className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="verifiedOnly" 
                      value="true" 
                      defaultChecked={verifiedOnly} 
                      className="size-4 rounded border-neutral-300 accent-teal-600 focus:ring-teal-500 transition-all" 
                    />
                    <span className="group-hover:text-neutral-900 transition-colors">Verified Profiles Only</span>
                  </label>
                  <label className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="remote" 
                      value="true" 
                      defaultChecked={remote} 
                      className="size-4 rounded border-neutral-300 accent-teal-600 focus:ring-teal-500 transition-all" 
                    />
                    <span className="group-hover:text-neutral-900 transition-colors">Remote / hybrid friendly</span>
                  </label>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 text-white h-11 rounded-lg font-medium shadow-sm">
                    Apply Filters
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </aside>

        {/* Candidates List Column */}
        <main className="space-y-5">
          {candidates.length > 0 ? (
            candidates.map((cand) => (
              <Card key={cand.id} className="bg-white border-neutral-200 hover:border-teal-300 hover:shadow-md transition-all duration-300 group rounded-xl overflow-hidden">
                <CardContent className="p-6 md:p-7 flex flex-col md:flex-row justify-between gap-6">
                  {/* Info block */}
                  <div className="flex gap-5">
                    {/* User profile picture */}
                    <div className="size-16 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-800 text-xl font-bold flex items-center justify-center shrink-0 border border-teal-100/50 overflow-hidden shadow-sm">
                      {cand.visibility !== "anonymous" && cand.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cand.profileImage} alt={cand.headline} className="size-full object-cover" />
                      ) : cand.visibility === "anonymous" ? (
                        "AN"
                      ) : (
                        `${cand.user.firstName[0] || ""}${cand.user.lastName[0] || ""}`
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-neutral-900 group-hover:text-teal-800 transition-colors">
                          {publicCandidateName(cand.user.firstName, cand.user.lastName, cand.visibility)}
                        </h4>
                        {cand.visibility === "anonymous" && (
                          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800 text-[10px] uppercase">
                            Anonymous
                          </Badge>
                        )}
                        {cand.isVerified && (
                          <span title="Verified Professional" className="bg-blue-50 text-blue-600 p-1 rounded-full">
                            <ShieldCheck className="size-3.5" />
                          </span>
                        )}
                        {cand.isOpenToWork && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none font-semibold px-2 py-0.5 text-[10px] uppercase tracking-wider">
                            Open to Work
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-base font-medium text-neutral-700">{cand.headline || "Talent Pool Candidate"}</p>
                      
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-neutral-500 flex items-center gap-1.5">
                          <MapPin className="size-4 opacity-70" />
                          {cand.city}, {cand.country}
                        </p>
                        {cand.educations && cand.educations.length > 0 && (
                          <p className="text-sm text-neutral-500 flex items-center gap-1.5 border-l pl-4">
                            <GraduationCap className="size-4 opacity-70" />
                            <span className="truncate max-w-[150px]">{cand.educations[0].institutionName}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                        {cand.noticePeriod ? <span>Notice: {cand.noticePeriod}</span> : null}
                        {cand.expectedSalary ? <span>Expected: {cand.expectedSalary}</span> : null}
                        {cand.targetLocation ? <span>Target: {cand.targetLocation}</span> : null}
                      </div>

                      {/* Pinned top skill keywords */}
                      {cand.skills && cand.skills.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-2">
                          {cand.skills.map((skill) => (
                            <Badge key={skill.id} variant="secondary" className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium px-2.5 py-0.5 rounded-md border border-neutral-200/60">
                              {skill.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col justify-between items-end gap-4 shrink-0 md:border-l md:border-neutral-100 md:pl-8">
                    <div className="text-right bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-100">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{cand.aiMatchScore !== null ? "AI Match" : "Confidence"}</p>
                      <span className="text-xl font-black text-teal-700">{cand.aiMatchScore ?? cand.candidateConfidence}%</span>
                    </div>
                    {cand.matchReasons.length ? (
                      <div className="max-w-48 rounded-lg border border-teal-100 bg-teal-50 p-2 text-left text-[10px] text-teal-900">
                        <div className="font-bold uppercase tracking-wider">Why matched</div>
                        <div className="mt-1">{cand.matchReasons.slice(0, 3).join(", ")}</div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2 w-full mt-auto">
                      {cand.customSlug ? (
                        <Button asChild className="bg-teal-700 hover:bg-teal-800 text-white gap-2 w-full shadow-sm" size="sm">
                          <Link href={`/${locale}/talent/${cand.customSlug}`}>
                            <span>View Profile</span>
                            <ChevronRight className="size-3.5 opacity-70" />
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled variant="outline" size="sm" className="w-full text-xs bg-neutral-50 text-neutral-400 border-neutral-200">
                          Profile Hidden
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="w-full gap-2 text-neutral-600 hover:text-neutral-900 border-neutral-200 shadow-sm">
                        <Bookmark className="size-3.5" /> Shortlist
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-24 text-center border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-4">
              <div className="mx-auto size-16 bg-white rounded-2xl border flex items-center justify-center shadow-sm">
                <Search className="size-8 text-neutral-300" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-semibold text-neutral-800">No candidates found</h4>
                <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  We couldn't find any professionals matching your exact criteria. Try adjusting the boolean search or clearing some filters.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-4 bg-white hover:bg-neutral-50 shadow-sm">
                <Link href={`/${locale}/talent-pool`}>Clear Filters</Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
