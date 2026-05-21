import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Plus, FolderGit2, Users, Clock, ArrowRight } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultLocale, isLocale } from "@/i18n-config";
import { getProjects } from "@/server/actions/recruiter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/recruiter/CreateProjectDialog";

export const metadata: Metadata = {
  title: "Hiring Projects & Pipelines - Career Studio",
  description: "Manage your recruitment pipelines and shortlisted candidates.",
};

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
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
    redirect(`/${locale}/talent-pool/company`);
  }

  const projects = await getProjects();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <FolderGit2 className="size-6 text-blue-600" />
            Hiring Projects
          </h1>
          <p className="mt-1.5 text-neutral-600">
            Organize candidates into pipelines and track them through your hiring process.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <Card className="border-2 border-dashed bg-neutral-50/50 py-16 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto size-16 bg-white rounded-2xl border flex items-center justify-center shadow-sm">
              <FolderGit2 className="size-8 text-neutral-300" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-neutral-800">No projects yet</h3>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto mt-1">
                Create a project to start building candidate pipelines and shortlists for your open roles.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/${locale}/talent-pool/projects/${project.id}`}>
              <Card className="h-full bg-white border border-neutral-200/80 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group rounded-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-neutral-50 to-white pb-4 border-b border-neutral-100">
                  <CardTitle className="text-lg font-semibold text-neutral-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                    {project.name}
                  </CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-neutral-600 font-medium bg-neutral-50 px-2.5 py-1 rounded-md border border-neutral-200">
                      <Users className="size-4 text-blue-600" />
                      {project._count.candidates} Candidates
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Clock className="size-3.5" />
                      <span className="text-xs">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-neutral-100 group-hover:border-blue-100 transition-colors">
                    <span className="text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                      View Board
                    </span>
                    <ArrowRight className="size-4 text-neutral-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
