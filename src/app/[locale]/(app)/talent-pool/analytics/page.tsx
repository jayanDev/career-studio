import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, TrendingUp, Users, Target, Activity, Send, CheckCircle, XCircle, Code2, LineChart, Banknote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Analytics & Insights - Recruiter Dashboard",
    description: "Track outreach response rates and view Talent Pool insights.",
  };
}

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!recruiter) {
    redirect(`/${locale}/talent-pool`);
  }

  // 1. Fetch Outreach Analytics
  const requests = await prisma.talentContactRequest.findMany({
    where: { recruiterId: session.user.id }
  });

  const totalRequests = requests.length;
  const accepted = requests.filter(r => r.status === "accepted").length;
  const declined = requests.filter(r => r.status === "declined").length;
  const pending = requests.filter(r => r.status === "pending").length;

  const responseRate = totalRequests > 0 ? Math.round(((accepted + declined) / totalRequests) * 100) : 0;
  const acceptanceRate = totalRequests > 0 ? Math.round((accepted / totalRequests) * 100) : 0;

  // 2. Fetch Talent Insights (Market Intelligence)
  // We'll query a sample of open-to-work profiles to aggregate skills and salaries
  const marketProfiles = await prisma.talentProfile.findMany({
    where: { isOpenToWork: true },
    select: { expectedSalary: true, skills: { select: { name: true } } },
    take: 500 // Limit for performance
  });

  const totalMarket = marketProfiles.length;

  // Aggregate Skills
  const skillCounts: Record<string, number> = {};
  marketProfiles.forEach(p => {
    p.skills.forEach(s => {
      skillCounts[s.name] = (skillCounts[s.name] || 0) + 1;
    });
  });
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Aggregate Salaries (very simple parsing since it's a string)
  let salarySum = 0;
  let salaryCount = 0;
  marketProfiles.forEach(p => {
    const num = parseInt(p.expectedSalary.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > 10000) { // filter out junk
      salarySum += num;
      salaryCount++;
    }
  });
  const avgSalary = salaryCount > 0 ? Math.round(salarySum / salaryCount) : 0;
  const formattedSalary = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(avgSalary);

  return (
    <div className="mx-auto max-w-6xl py-8 space-y-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          <Link href={`/${locale}/talent-pool`} className="hover:text-neutral-900 transition-colors">Talent Pool</Link>
          <span>/</span>
          <span className="text-neutral-900 font-medium">Analytics & Insights</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 flex items-center gap-3">
          <BarChart3 className="size-8 text-orange-600" />
          Analytics & Market Insights
        </h1>
        <p className="text-neutral-600 max-w-2xl">
          Track your outreach performance and discover real-time trends from the candidate pool to optimize your hiring strategy.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2 border-b pb-2">
          <Send className="size-5 text-teal-600" />
          Your Outreach Performance
        </h2>
        
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-neutral-500 mb-1">Total Inquiries Sent</p>
              <h3 className="text-3xl font-black text-neutral-900">{totalRequests}</h3>
              <p className="text-xs text-neutral-400 mt-2">Credits Remaining: {recruiter.contactCredits}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-neutral-500 mb-1">Response Rate</p>
              <h3 className="text-3xl font-black text-neutral-900">{responseRate}%</h3>
              <Progress value={responseRate} className="h-1.5 mt-3" />
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-neutral-500 mb-1">Acceptance Rate</p>
              <h3 className="text-3xl font-black text-teal-700">{acceptanceRate}%</h3>
              <Progress value={acceptanceRate} className="h-1.5 mt-3" />
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-neutral-500 mb-1">Pending Replies</p>
              <h3 className="text-3xl font-black text-amber-600">{pending}</h3>
              <p className="text-xs text-neutral-400 mt-2">Awaiting candidate action</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-6 pt-6">
        <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2 border-b pb-2">
          <Activity className="size-5 text-indigo-600" />
          Talent Market Intelligence
        </h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code2 className="size-5 text-indigo-500" /> Top Skills in Demand
              </CardTitle>
              <CardDescription>Most frequent skills among {totalMarket} active candidates.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topSkills.map(([skill, count], i) => (
                  <div key={skill} className="flex items-center gap-4">
                    <span className="w-6 text-sm font-bold text-neutral-400">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-neutral-800">{skill}</span>
                        <span className="text-neutral-500">{count} profiles</span>
                      </div>
                      <Progress value={(count / totalMarket) * 100} className="h-2" />
                    </div>
                  </div>
                ))}
                {topSkills.length === 0 && (
                  <p className="text-sm text-neutral-500 text-center py-6">Not enough data to compute skill trends.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-white border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Banknote className="size-5 text-emerald-500" /> Average Salary Expectations
                </CardTitle>
                <CardDescription>Based on parsed data from active profiles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="size-12 bg-white rounded-full flex items-center justify-center shrink-0">
                    <LineChart className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Platform Average</p>
                    <p className="text-2xl font-black text-emerald-700">{avgSalary > 0 ? formattedSalary : "N/A"}</p>
                    <p className="text-xs text-emerald-800/70 mt-0.5">Based on {salaryCount} profiles with declared expected salaries.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-md">
              <CardContent className="p-6">
                <Target className="size-8 text-amber-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">How to improve your response rate?</h3>
                <ul className="space-y-2 text-sm text-neutral-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Personalize your message using the <strong>AI Draft</strong> tool.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Ensure your <strong>Company Identity</strong> profile is fully verified.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>Target candidates whose <strong>Career Level</strong> aligns with your budget.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
