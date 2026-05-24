// Candidate avatars come from arbitrary remote URLs without known
// dimensions; keep <img> intentionally rather than configuring
// next/image with width/height + remote-image policy.
/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, ShieldCheck, ChevronRight, Trash2, ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShortlistedTalent, toggleShortlist } from "@/server/actions/recruiter";

type ShortlistPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateMetadata(): Metadata {
  return {
    title: "My Saved Candidates - Career Studio",
    description: "Manage your shortlisted candidates, review saved profiles, and coordinate outreach pipelines.",
  };
}

export default async function ShortlistPage({ params }: ShortlistPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  // Check recruiter status
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!recruiter) {
    redirect(`/${locale}/talent-pool`);
  }

  const shortlistedList = await getShortlistedTalent();

  // Server Action handler to remove shortlist item
  const handleRemoveShortlist = async (formData: FormData) => {
    "use server";
    const profileId = formData.get("profileId") as string;
    if (profileId) {
      await toggleShortlist(profileId);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/talent-pool`} className="flex items-center gap-1">
            <ArrowLeft className="size-4" />
            <span>Back to Candidates</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 flex items-center gap-2.5">
          <Bookmark className="size-7 text-teal-700 fill-teal-100" />
          <span>My Shortlist</span>
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Review candidate profiles you've saved. Initiate outreach contact requests when ready.
        </p>
      </div>

      <div className="border-t pt-6">
        {shortlistedList.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {shortlistedList.map((item) => {
              const cand = item.talentProfile;
              return (
                <Card key={item.id} className="bg-white border hover:border-slate-350 hover:shadow-sm transition-all flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-3">
                        <div className="size-11 rounded-full bg-teal-50 text-teal-800 text-md font-bold flex items-center justify-center shrink-0 border overflow-hidden">
                          {cand.profileImage ? (
                            <img src={cand.profileImage} alt={cand.headline} className="size-full object-cover" />
                          ) : (
                            `${cand.user.firstName[0] || ""}${cand.user.lastName[0] || ""}`
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                            <span>{cand.user.firstName} {cand.user.lastName}</span>
                            {cand.isVerified && (
                              <ShieldCheck className="size-4.5 text-teal-600" />
                            )}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-0.5">{cand.city}, {cand.country}</p>
                        </div>
                      </div>
                      <form action={handleRemoveShortlist}>
                        <input type="hidden" name="profileId" value={cand.id} />
                        <Button 
                          type="submit" 
                          variant="ghost" 
                          size="icon" 
                          className="size-8 text-neutral-400 hover:text-red-700 hover:bg-red-50"
                          title="Remove from shortlist"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-1 pt-1">
                      <p className="text-xs font-semibold text-neutral-850">{cand.headline || "Talent Candidate"}</p>
                      <p className="text-xs text-neutral-600 line-clamp-2">{cand.bio || "No summary biography available."}</p>
                    </div>

                    {cand.skills && cand.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {cand.skills.map((skill) => (
                          <Badge key={skill.id} variant="outline" className="text-[9px] border-slate-200 py-0.5">
                            {skill.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>

                  <div className="bg-slate-50/50 p-4 border-t flex justify-between items-center text-xs">
                    <span className="text-neutral-400">
                      Saved {new Date(item.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                    </span>
                    {cand.customSlug ? (
                      <Button asChild className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1 py-1" size="xs">
                        <Link href={`/${locale}/talent/${cand.customSlug}`}>
                          <span>View Profile</span>
                          <ChevronRight className="size-3" />
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-neutral-400 italic">Private profile</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center border border-dashed rounded-2xl bg-white space-y-3">
            <Bookmark className="size-8 text-neutral-300 mx-auto" />
            <h4 className="font-semibold text-neutral-700">No saved candidates</h4>
            <p className="text-sm text-neutral-500 max-w-xs mx-auto">
              Save profiles from the Talent Pool to view and manage them on your shortlist dashboard.
            </p>
            <div className="pt-2">
              <Button asChild className="bg-teal-700 hover:bg-teal-800 text-white gap-1" size="sm">
                <Link href={`/${locale}/talent-pool`}>
                  Browse Candidates
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
