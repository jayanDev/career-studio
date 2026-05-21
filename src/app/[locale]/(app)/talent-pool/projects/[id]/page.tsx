import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings, Users, FolderGit2 } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultLocale, isLocale } from "@/i18n-config";
import { Button } from "@/components/ui/button";
import { ProjectKanbanBoard } from "@/components/recruiter/ProjectKanbanBoard";

export async function generateMetadata({ params }: { params: Promise<{ id: string, locale: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.recruiterProject.findUnique({
    where: { id }
  });
  
  return {
    title: project ? `${project.name} - Pipeline` : "Project Pipeline",
  };
}

export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const project = await prisma.recruiterProject.findUnique({
    where: { 
      id,
      recruiterId: session.user.id // Ensure ownership
    },
    include: {
      candidates: {
        include: {
          talentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, image: true } },
              experiences: { take: 1, orderBy: { startDate: "desc" } }
            }
          }
        }
      }
    }
  });

  if (!project) {
    redirect(`/${locale}/talent-pool/projects`);
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-6 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href={`/${locale}/talent-pool/projects`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <ArrowLeft className="size-3.5" /> Projects
            </Link>
            <span>/</span>
            <span className="truncate max-w-[200px]">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <FolderGit2 className="size-5 text-blue-600" />
            {project.name}
          </h1>
          {project.description && (
            <p className="text-neutral-600 text-sm max-w-2xl">{project.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg shadow-sm">
            <Users className="size-4 text-blue-500" />
            {project.candidates.length} Candidates
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="size-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-neutral-50/50 rounded-2xl border border-neutral-200 shadow-inner">
        <ProjectKanbanBoard project={project} locale={locale} />
      </div>
    </div>
  );
}
