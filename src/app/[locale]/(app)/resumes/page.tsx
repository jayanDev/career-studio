import type { Metadata } from "next";
import Link from "next/link";
import { Copy, Download, FileText, Plus, LayoutTemplate } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { featuredResumeTemplates } from "@/lib/resume-templates";
import { createResumeFromForm, duplicateResumeAction } from "@/server/actions/resumes/create-resume";

type ResumesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ResumesPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.resumes" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ResumesPage({ params }: ResumesPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.resumes" });
  const session = await auth();
  const createAction = createResumeFromForm.bind(null, locale);
  const resumes = session?.user?.id
    ? await prisma.resume.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 24,
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t("subtitle")}</p>
        </div>
      </div>

      <Card className="bg-slate-50/50 border-dashed border-2 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <LayoutTemplate className="size-5 text-teal-700" />
            {t("createTitle")}
          </CardTitle>
          <CardDescription>Select a layout and start building a tailored resume</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-600 uppercase">Resume Name</Label>
                  <Input name="title" placeholder="e.g. Tech Lead - Sysco LABS" required className="bg-white" />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-600 uppercase">Target Role / Goal</Label>
                  <Input name="targetRole" placeholder="e.g. Senior Software Engineer" className="bg-white" />
               </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-neutral-600 uppercase">Select Template</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {featuredResumeTemplates.map((template) => (
                   <label key={template.templateKey} className="cursor-pointer group relative">
                      <input type="radio" name="templateKey" value={template.templateKey} className="peer sr-only" required />
                      <div className="border-2 rounded-xl p-2 peer-checked:border-teal-600 peer-checked:bg-teal-50 peer-checked:ring-4 peer-checked:ring-teal-600/10 transition-all aspect-[1/1.3] bg-white flex flex-col hover:border-teal-300">
                         {/* Visual thumbnail placeholder representing a document layout */}
                         <div className="bg-neutral-50 rounded flex-1 mb-2 border border-slate-100 flex flex-col p-1.5 gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <div className="h-1.5 w-1/2 bg-slate-300 rounded-full" />
                            <div className="h-0.5 w-1/3 bg-slate-200 rounded-full" />
                            <div className="h-px w-full bg-slate-100 my-1" />
                            <div className="flex gap-1 flex-1">
                               <div className="w-1/3 h-full bg-slate-200/50 rounded-sm" />
                               <div className="flex-1 h-full bg-slate-100 rounded-sm" />
                            </div>
                         </div>
                         <div className="text-center font-semibold text-[11px] truncate px-1 text-slate-800 leading-tight">
                           {template.roleName}
                         </div>
                         <div className="text-center text-[9px] text-slate-500 font-medium">
                           {template.category}
                         </div>
                      </div>
                   </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
               <Button type="submit" size="lg" className="bg-teal-700 text-white hover:bg-teal-800 font-semibold px-8 shadow-sm">
                 <Plus className="size-4 mr-2" /> {t("create")}
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {resumes.map((resume) => (
          <Card key={resume.id} className="bg-white flex flex-col group hover:shadow-md hover:border-teal-200 transition-all">
            <CardHeader className="pb-4 flex-1">
              <div className="flex items-start justify-between gap-3">
                <Badge className="bg-teal-50 text-teal-800 border-teal-100 hover:bg-teal-100 rounded-md">
                  {resume.templateKey}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-800 bg-emerald-50 text-[10px] tracking-wide uppercase">
                  Active
                </Badge>
              </div>
              <CardTitle className="mt-3 text-lg leading-tight line-clamp-2 group-hover:text-teal-800 transition-colors">
                {resume.title}
              </CardTitle>
              <div className="text-xs text-neutral-500 flex flex-col gap-1.5 mt-2">
                 <span>Updated {resume.updatedAt.toLocaleDateString("en-LK")} at {resume.updatedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 <span className="flex items-center gap-1.5 mt-1 font-medium text-slate-600 bg-slate-50 w-fit px-2 py-1 rounded">
                   <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                   ATS Check: Ready
                 </span>
              </div>
            </CardHeader>
            <CardFooter className="grid grid-cols-4 gap-2 bg-slate-50/50 pt-3 border-t">
              <Button asChild variant="outline" size="sm" className="col-span-2 gap-1.5 font-semibold text-teal-850 hover:bg-teal-50 hover:text-teal-900 border-teal-200/50">
                <Link href={`/${locale}/resumes/${resume.id}`}>{t("edit")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" title="Download PDF" className="w-full px-0 border-slate-200 hover:bg-slate-100 text-slate-700">
                <Link href={`/api/resumes/${resume.id}/export/pdf`}>
                  <Download className="size-4" />
                </Link>
              </Button>
              <form action={duplicateResumeAction.bind(null, locale, resume.id)} className="w-full">
                <Button type="submit" variant="outline" size="sm" title="Duplicate" className="w-full px-0 border-slate-200 hover:bg-slate-100 text-slate-700">
                  <Copy className="size-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <FileText className="mx-auto size-10 text-teal-700" />
          <h2 className="mt-4 text-xl font-semibold text-neutral-950">{t("emptyTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-600">{t("emptyBody")}</p>
        </div>
      ) : null}
    </div>
  );
}
