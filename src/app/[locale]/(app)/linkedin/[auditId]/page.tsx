import type { Metadata } from "next";
import Link from "next/link";
import { 
  ArrowLeft, CheckCircle2, AlertTriangle, Sparkles, User, ShieldCheck, 
  Printer, Layers, FileText, CheckCircle, Info, Landmark,
  Globe, Loader2
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ShareToggleButton } from "@/components/share-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { linkedInAuditResultSchema } from "@/lib/linkedin-audit";
import { prisma } from "@/lib/prisma";
import { requestLinkedInRewriteAction } from "@/server/actions/linkedin/audit";

type LinkedInAuditPageProps = {
  params: Promise<{ locale: string; auditId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LinkedInAuditPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.linkedinAudit" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LinkedInAuditPage({ params }: LinkedInAuditPageProps) {
  const { locale: rawLocale, auditId } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.linkedin" });
  const session = await auth();
  
  const audit = session?.user?.id
    ? await prisma.linkedInAudit.findFirst({
        where: { id: auditId, userId: session.user.id },
      })
    : null;

  if (!audit) {
    return (
      <div className="rounded-lg border bg-white p-8">
        <Button asChild variant="outline">
          <Link href={`/${locale}/linkedin`}>{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const [resultRecord, rewrites, extractedProfile] = await Promise.all([
    prisma.linkedInAuditResult.findUnique({ where: { auditId: audit.id } }),
    prisma.linkedInRewriteSuggestion.findMany({ where: { auditId: audit.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.linkedInExtractedProfile.findUnique({ where: { auditId: audit.id } }),
  ]);

  const dataJson = (extractedProfile?.dataJson as any) || {};

  const parsed = resultRecord
    ? linkedInAuditResultSchema.safeParse({
        score_breakdown: resultRecord.scoreBreakdown,
        missing_keywords: resultRecord.missingKeywords,
        section_scores: resultRecord.sectionScores,
        checklist_items: resultRecord.checklistItems,
        summary_feedback: resultRecord.summaryFeedback,
        headline_analysis: dataJson.headline_analysis || {},
        about_analysis: dataJson.about_analysis || {},
        rec_endorsement_analysis: dataJson.rec_endorsement_analysis || {},
        featured_audit: dataJson.featured_audit || {},
        open_to_work_audit: dataJson.open_to_work_audit || {},
        sri_lanka_moat: dataJson.sri_lanka_moat || {},
        profile_media_audit: dataJson.profile_media_audit || {},
        jd_keyword_analysis: dataJson.jd_keyword_analysis || {},
        activity_analysis: dataJson.activity_analysis || {},
        skills_optimizer: dataJson.skills_optimizer || {},
        benchmark: dataJson.benchmark || {},
      })
    : null;

  const action = requestLinkedInRewriteAction.bind(null, locale, audit.id);

  let overall = 0;
  let thresholdLabel = "Major sections need work";
  let thresholdColor = "text-rose-600 border-rose-200 bg-rose-50/50";

  if (parsed?.success) {
    const s = parsed.data.score_breakdown;
    overall = Math.round(s.profile_strength + s.authority + s.findability + s.engagement_readiness);
    if (overall >= 90) {
      thresholdLabel = "Recruiter-ready (Outstanding)";
      thresholdColor = "text-emerald-700 border-emerald-200 bg-emerald-50/50";
    } else if (overall >= 75) {
      thresholdLabel = "Strong profile, minor polish";
      thresholdColor = "text-teal-700 border-teal-200 bg-teal-50/50";
    } else if (overall >= 60) {
      thresholdLabel = "Visible but missing key signals";
      thresholdColor = "text-amber-700 border-amber-200 bg-amber-50/50";
    } else {
      thresholdLabel = "Major sections need work";
      thresholdColor = "text-rose-700 border-rose-200 bg-rose-50/50";
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header controls */}
      <div className="flex justify-between items-center print:hidden">
        <Button asChild variant="outline" className="text-xs">
          <Link href={`/${locale}/linkedin`}>
            <ArrowLeft className="size-4 mr-1" />
            {t("back")}
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="text-xs">
            <Link href={`/linkedin/share/${audit.id}`}>
              <Globe className="size-3.5 mr-1" />
              Public share
            </Link>
          </Button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 shadow-xs transition-all"
          >
            <Printer className="size-3.5 text-teal-700" />
            Export / Print Report
          </button>
        </div>
      </div>

      {/* Main score card */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center justify-between p-6 rounded-2xl border bg-white shadow-xs">
        <div className="space-y-1.5">
          <Badge variant="outline" className="text-[10px] uppercase font-bold border-teal-600/30 text-teal-800 bg-teal-50/30">
            LinkedIn SSI Audit
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            {audit.targetRole || "Professional Profile"}
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            Analyzed on {audit.createdAt.toLocaleDateString("en-LK")} (Target Role Match)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`px-3 py-1 rounded-full border text-[10px] font-bold ${thresholdColor} uppercase tracking-wider`}>
              {thresholdLabel}
            </div>
            <div className="text-[10px] text-neutral-400 font-semibold mt-1">Overall Profile Grade</div>
          </div>
          <div className="size-20 rounded-full border-4 border-teal-500 flex flex-col items-center justify-center bg-teal-50/20 shadow-xs">
            <span className="text-3xl font-extrabold text-teal-700">{overall}</span>
            <span className="text-[9px] font-bold text-teal-600/70">/100</span>
          </div>
          <ShareToggleButton
            kind="linkedin"
            id={audit.id}
            initiallyShared={!!audit.shareToken}
            initialToken={audit.shareToken}
            locale={locale}
          />
        </div>
      </div>

      {parsed?.success ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left Column: Dimensions & Keywords */}
          <div className="space-y-6">
            {/* 4-Dimension SSI breakdown */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <Layers className="size-4 text-teal-700" />
                  4-Dimension SSI Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { 
                    name: "Profile Strength", 
                    score: parsed.data.score_breakdown.profile_strength, 
                    desc: "Audits profile photo, custom banner, headline, hook presence, and vanity URL." 
                  },
                  { 
                    name: "Authority & Social Proof", 
                    score: parsed.data.score_breakdown.authority, 
                    desc: "Measures recommendations received/given, certificates, featured items, and recognized employers." 
                  },
                  { 
                    name: "Findability & SEO Density", 
                    score: parsed.data.score_breakdown.findability, 
                    desc: "Checks keyword density against target role / JD, skills endorsement, and search optimization." 
                  },
                  { 
                    name: "Engagement Readiness", 
                    score: parsed.data.score_breakdown.engagement_readiness, 
                    desc: "Evaluates call to action (CTA), open to work settings, phone format, and layout completion." 
                  },
                ].map((dim) => {
                  const pct = Math.round((dim.score / 25) * 100);
                  return (
                    <div key={dim.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-900">
                        <span>{dim.name}</span>
                        <span className="text-teal-700">{dim.score} <span className="text-neutral-400 font-normal">/ 25</span></span>
                      </div>
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-teal-600 rounded-full transition-all" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-4">{dim.desc}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <FileText className="size-4 text-teal-700" />
                  Profile Media & JD Match
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-neutral-50 p-3">
                    <div className="text-[10px] font-bold uppercase text-neutral-400">Photo</div>
                    <div className="mt-1 text-lg font-extrabold text-neutral-900">{parsed.data.profile_media_audit.photo_score}/100</div>
                    <p className="mt-1 text-[10px] leading-4 text-neutral-500">{parsed.data.profile_media_audit.photo_feedback[0]}</p>
                  </div>
                  <div className="rounded-lg border bg-neutral-50 p-3">
                    <div className="text-[10px] font-bold uppercase text-neutral-400">Banner</div>
                    <div className="mt-1 text-lg font-extrabold text-neutral-900">{parsed.data.profile_media_audit.banner_score}/100</div>
                    <p className="mt-1 text-[10px] leading-4 text-neutral-500">{parsed.data.profile_media_audit.banner_feedback[0]}</p>
                  </div>
                  <div className="rounded-lg border bg-neutral-50 p-3">
                    <div className="text-[10px] font-bold uppercase text-neutral-400">JD Match</div>
                    <div className="mt-1 text-lg font-extrabold text-teal-700">{parsed.data.jd_keyword_analysis.match_score}%</div>
                    <p className="mt-1 text-[10px] leading-4 text-neutral-500">{parsed.data.jd_keyword_analysis.matched_keywords.length} weighted keywords matched</p>
                  </div>
                </div>
                {parsed.data.jd_keyword_analysis.extracted.hard_skills.length ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Structured JD Keywords</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...parsed.data.jd_keyword_analysis.extracted.hard_skills, ...parsed.data.jd_keyword_analysis.extracted.tools].slice(0, 16).map((keyword) => (
                        <Badge key={keyword} variant="outline" className="bg-white text-[10px]">{keyword}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Headline and About audits */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <User className="size-4 text-teal-700" />
                  Headline & About Auditor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Headline Audit */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="text-xs font-bold text-neutral-900">Headline Meter</span>
                    <Badge variant={parsed.data.headline_analysis.mobile_visible ? "secondary" : "outline"} className="text-[9px]">
                      {parsed.data.headline_analysis.char_count} chars
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="bg-neutral-50 p-2.5 rounded-lg border text-center">
                      <div className="text-xs font-bold text-teal-700">{parsed.data.headline_analysis.hook_strength_score}%</div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase mt-0.5">Headline Hook Score</div>
                    </div>
                    <div className="bg-neutral-50 p-2.5 rounded-lg border text-center">
                      <div className="text-xs font-bold text-neutral-700">{parsed.data.headline_analysis.format_type}</div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase mt-0.5">Detected Layout Format</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-neutral-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2 rounded-full ${parsed.data.headline_analysis.has_value_prop ? "bg-teal-500" : "bg-neutral-300"}`} />
                      Value proposition or objective hook present
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2 rounded-full ${parsed.data.headline_analysis.has_outcome_metrics ? "bg-teal-500" : "bg-neutral-300"}`} />
                      Outcome metrics or credentials included
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2 rounded-full ${parsed.data.headline_analysis.mobile_visible ? "bg-teal-500" : "bg-rose-500"}`} />
                      Mobile preview visible (&lt; 70 chars limit warning)
                    </div>
                  </div>
                  {parsed.data.headline_analysis.suggestions.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-800 font-semibold">
                      {parsed.data.headline_analysis.suggestions.map((s, idx) => (
                        <div key={idx} className="flex gap-1 items-start">
                          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* About Audit */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="text-xs font-bold text-neutral-900">About Hook & Narrative Arc</span>
                    <span className="text-[10px] text-neutral-400 font-medium">{parsed.data.about_analysis.word_count} words</span>
                  </div>
                  <div className="bg-neutral-50 p-3 rounded-lg border font-mono text-[10px] text-neutral-600 italic">
                    "{parsed.data.about_analysis.first_220_chars}..."
                    <div className="text-[9px] text-neutral-400 font-bold uppercase mt-2.5 not-italic border-t pt-1.5">
                      First 220 chars hook strength: {parsed.data.about_analysis.first_220_hook_strength}%
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-neutral-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <div className={`size-2 rounded-full ${parsed.data.about_analysis.has_cta ? "bg-teal-500" : "bg-rose-500"}`} />
                      Clear Call to Action (CTA) included at the end
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Info className="size-3.5 text-teal-600" />
                      <span>{parsed.data.about_analysis.pronoun_balance}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="size-3.5 text-teal-600" />
                      <span>{parsed.data.about_analysis.story_arc}</span>
                    </div>
                  </div>
                  {parsed.data.about_analysis.suggestions.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-800 font-semibold">
                      {parsed.data.about_analysis.suggestions.map((s, idx) => (
                        <div key={idx} className="flex gap-1 items-start">
                          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Keyword Density match */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <Sparkles className="size-4 text-teal-700" />
                  {t("missingKeywords")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {parsed.data.missing_keywords.map((keyword) => (
                  <div key={`${keyword.keyword}-${keyword.placement}`} className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3.5 flex items-start justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 text-xs">{keyword.keyword}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
                            keyword.priority === "HIGH" ? "border-rose-300 text-rose-800 bg-rose-50" : "border-amber-300 text-amber-800 bg-amber-50"
                          }`}
                        >
                          {keyword.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500 font-medium">Placement: {keyword.placement}</p>
                    </div>
                  </div>
                ))}
                {parsed.data.missing_keywords.length === 0 && (
                  <p className="text-xs text-neutral-400 italic text-center py-4">No missing keywords! Excellent SEO alignment.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Sri Lanka Moat, Social Proof & Rewriter */}
          <div className="space-y-6">
            {/* Sri Lanka Moat Panel */}
            <Card className="bg-gradient-to-br from-teal-900 to-cyan-950 text-white shadow-md rounded-xl overflow-hidden border-0">
              <CardHeader className="py-4 border-b border-teal-800 bg-black/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Landmark className="size-4 text-teal-300" />
                  Sri Lankan Market Localization (Moat Sprints)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {/* NIC Warning Alert */}
                {parsed.data.sri_lanka_moat.has_nic_warning && (
                  <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-3.5 flex gap-2.5 items-start">
                    <AlertTriangle className="size-5 text-rose-300 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-100">National Identity Card (NIC) Detected!</h4>
                      <p className="text-[10px] text-rose-200 mt-1 leading-4">
                        We detected a raw Sri Lankan NIC number. Publicly exposing NIC details is a safety risk. Mask it before recruiters view.
                      </p>
                    </div>
                  </div>
                )}

                {/* Local Phone check */}
                {parsed.data.sri_lanka_moat.lk_phone_normalized && (
                  <div className="bg-teal-950/40 border border-teal-800 rounded-xl p-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="text-[9px] font-bold text-teal-400 uppercase">Sri Lankan Phone Formatting</div>
                      <div className="font-mono mt-0.5 text-teal-100">{parsed.data.sri_lanka_moat.lk_phone_normalized}</div>
                    </div>
                    <Badge className="bg-teal-700 text-[10px]">Normalized LK Format</Badge>
                  </div>
                )}

                {/* University and Employer badges */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-teal-950/40 border border-teal-800 rounded-xl p-3.5 space-y-2">
                    <div className="text-[9px] font-bold text-teal-400 uppercase tracking-wider">SL Universities Recognized</div>
                    {parsed.data.sri_lanka_moat.local_universities_matched.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {parsed.data.sri_lanka_moat.local_universities_matched.map(uni => (
                          <Badge key={uni} className="bg-teal-800 text-[9px] uppercase font-bold text-teal-100">
                            {uni}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-teal-300/60 italic">No top SL universities detected.</p>
                    )}
                  </div>

                  <div className="bg-teal-950/40 border border-teal-800 rounded-xl p-3.5 space-y-2">
                    <div className="text-[9px] font-bold text-teal-400 uppercase tracking-wider">SL Employers Recognized</div>
                    {parsed.data.sri_lanka_moat.local_companies_matched.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {parsed.data.sri_lanka_moat.local_companies_matched.map(comp => (
                          <Badge key={comp} className="bg-teal-800 text-[9px] uppercase font-bold text-teal-100">
                            {comp}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-teal-300/60 italic">No recognized SL employers detected.</p>
                    )}
                  </div>
                </div>

                {/* Local Certifications */}
                {parsed.data.sri_lanka_moat.local_certs_matched.length > 0 && (
                  <div className="bg-teal-950/40 border border-teal-800 rounded-xl p-3">
                    <div className="text-[9px] font-bold text-teal-400 uppercase">Local Certifications</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {parsed.data.sri_lanka_moat.local_certs_matched.map(cert => (
                        <Badge key={cert} className="bg-emerald-800 text-[9px] text-emerald-100">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bilingual and Hashtags */}
                <div className="space-y-3 pt-3 border-t border-teal-800 text-xs">
                  {parsed.data.sri_lanka_moat.bilingual_support && (
                    <div className="flex items-center gap-2 text-teal-200">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <span>{parsed.data.sri_lanka_moat.bilingual_support}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-teal-200">
                    <Globe className="size-4 text-teal-400 shrink-0" />
                    <span>{parsed.data.sri_lanka_moat.diaspora_leverage}</span>
                  </div>

                  {parsed.data.sri_lanka_moat.compliance_mode_warning && (
                    <div className="flex items-center gap-2 text-rose-300">
                      <AlertTriangle className="size-4 text-rose-400 shrink-0" />
                      <span>{parsed.data.sri_lanka_moat.compliance_mode_warning}</span>
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    <div className="text-[9px] font-bold text-teal-400 uppercase">Colombo & Local Hashtag Package:</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {parsed.data.sri_lanka_moat.local_hashtags.map(tag => (
                        <span key={tag} className="font-mono text-xs text-teal-300 font-semibold">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social proof and checklist items */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-teal-700" />
                    Social Proof & Recommendations
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    Recs: {parsed.data.rec_endorsement_analysis.recs_received} Recv
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="bg-neutral-50 border p-3 rounded-lg text-center">
                    <div className="text-sm font-bold text-neutral-800">{parsed.data.rec_endorsement_analysis.recs_received}</div>
                    <div className="text-[9px] text-neutral-400 uppercase font-bold mt-0.5">Recommendations Received</div>
                  </div>
                  <div className="bg-neutral-50 border p-3 rounded-lg text-center">
                    <div className="text-sm font-bold text-neutral-800">{parsed.data.rec_endorsement_analysis.recs_given}</div>
                    <div className="text-[9px] text-neutral-400 uppercase font-bold mt-0.5">Recommendations Given</div>
                  </div>
                </div>

                <div className="text-xs space-y-2 text-neutral-600 font-medium pt-1.5">
                  <div className="flex items-start gap-2 bg-teal-50/50 border border-teal-100 rounded-lg p-3 text-[11px] text-teal-950">
                    <Info className="size-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{parsed.data.rec_endorsement_analysis.endorsement_feedback}</span>
                  </div>

                  {parsed.data.rec_endorsement_analysis.suggested_rec_ask && (
                    <div className="flex items-start gap-2 bg-neutral-50 border rounded-lg p-3 text-[11px]">
                      <Info className="size-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <span>{parsed.data.rec_endorsement_analysis.suggested_rec_ask}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <div className={`size-2 rounded-full ${parsed.data.featured_audit.is_populated ? "bg-teal-500" : "bg-neutral-300"}`} />
                    <span>Featured Section: {parsed.data.featured_audit.is_populated ? "Populated" : "Not populated / Missing links"}</span>
                  </div>

                  {parsed.data.featured_audit.suggestions.map((s, idx) => (
                    <p key={idx} className="text-[10px] text-neutral-400 italic pl-3.5">
                      💡 {s}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <Globe className="size-4 text-teal-700" />
                  Activity, Skills & Benchmark
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border bg-neutral-50 p-3 text-center">
                    <div className="text-sm font-bold text-neutral-800">{parsed.data.activity_analysis.posts_per_week}</div>
                    <div className="text-[9px] uppercase font-bold text-neutral-400">Posts / week</div>
                  </div>
                  <div className="rounded-lg border bg-neutral-50 p-3 text-center">
                    <div className="text-sm font-bold text-neutral-800">{parsed.data.activity_analysis.last_post_days_ago}</div>
                    <div className="text-[9px] uppercase font-bold text-neutral-400">Days since post</div>
                  </div>
                  <div className="rounded-lg border bg-neutral-50 p-3 text-center">
                    <div className="text-sm font-bold text-neutral-800">{parsed.data.activity_analysis.engagement_score}</div>
                    <div className="text-[9px] uppercase font-bold text-neutral-400">Engagement score</div>
                  </div>
                </div>
                <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-3 text-[11px] leading-5 text-teal-950">
                  <strong>{parsed.data.activity_analysis.cadence_label}.</strong> {parsed.data.activity_analysis.best_time_to_post}
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Suggested Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.data.skills_optimizer.suggested_skills.slice(0, 14).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recruiter Boolean Searches</div>
                  {parsed.data.skills_optimizer.boolean_search_examples.map((search) => (
                    <div key={search} className="rounded-md bg-neutral-950 px-3 py-2 font-mono text-[10px] text-neutral-100">{search}</div>
                  ))}
                </div>
                <div className="space-y-2 border-t pt-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{parsed.data.benchmark.peer_label}</div>
                  {parsed.data.benchmark.gaps.slice(0, 3).map((gap) => (
                    <div key={gap} className="flex items-start gap-2 text-[11px] text-neutral-600">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      <span>{gap}</span>
                    </div>
                  ))}
                  {parsed.data.benchmark.reaudit_recommended_on ? (
                    <p className="text-[10px] font-semibold text-teal-700">Re-audit reminder target: {parsed.data.benchmark.reaudit_recommended_on}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-teal-700" />
                  {t("checklist")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {parsed.data.checklist_items.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-xl border border-neutral-100 bg-neutral-50/30 p-3 shadow-2xs">
                    <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${item.completed ? "text-teal-600" : "text-neutral-300"}`} />
                    <div>
                      <div className="font-semibold text-neutral-900 text-xs">{item.label}</div>
                      <div className="mt-0.5 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Impact: {item.impact}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Legacy rewrite drawer controls */}
            <Card className="bg-white border-neutral-200 shadow-sm rounded-xl overflow-hidden print:hidden">
              <CardHeader className="py-4 border-b bg-neutral-50/50">
                <CardTitle className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <Sparkles className="size-4 text-teal-700" />
                  {t("rewriteTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <form action={action} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                  <select name="sectionType" className="h-9 rounded-md border bg-white px-3 text-xs font-semibold">
                    <option value="headline">{t("headline")}</option>
                    <option value="about">{t("about")}</option>
                    <option value="experience">{t("experience")}</option>
                  </select>
                  <select name="tone" className="h-9 rounded-md border bg-white px-3 text-xs font-semibold">
                    <option value="STANDARD">{t("standard")}</option>
                    <option value="PUNCHY">{t("punchy")}</option>
                    <option value="LEADERSHIP">{t("leadership")}</option>
                  </select>
                  <Button type="submit" className="bg-teal-750 text-white hover:bg-teal-855 text-xs font-bold shadow-xs">
                    <Sparkles className="size-3.5 mr-1" />
                    {t("rewrite")}
                  </Button>
                </form>
                {rewrites.map((rewrite) => (
                  <div key={rewrite.id} className="rounded-xl border border-teal-100 bg-teal-50/30 p-4 shadow-2xs">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                      {rewrite.sectionType} ({rewrite.tone})
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-5 text-teal-950 font-medium">{rewrite.rewritten}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="bg-white">
          <CardContent className="p-8 text-sm text-neutral-600 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="size-8 text-teal-600 animate-spin" />
            <span>Analyzing Profile Audits...</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
