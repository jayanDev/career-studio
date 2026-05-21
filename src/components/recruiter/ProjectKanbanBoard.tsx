"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreVertical, Mail, ExternalLink, Calendar, MapPin, Building2, GripVertical } from "lucide-react";

import { updateCandidateStage } from "@/server/actions/recruiter";
import { Badge } from "@/components/ui/badge";

const STAGES = [
  { id: "new", label: "Sourced", color: "bg-slate-100 border-slate-200 text-slate-800" },
  { id: "reviewed", label: "Reviewed", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { id: "contacted", label: "Contacted", color: "bg-purple-50 border-purple-200 text-purple-800" },
  { id: "interview", label: "Interview", color: "bg-amber-50 border-amber-200 text-amber-800" },
  { id: "offered", label: "Offered", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { id: "hired", label: "Hired", color: "bg-teal-50 border-teal-200 text-teal-800" },
  { id: "rejected", label: "Rejected", color: "bg-red-50 border-red-200 text-red-800" },
];

export function ProjectKanbanBoard({ project, locale }: any) {
  const [candidates, setCandidates] = useState(project.candidates);
  const [isPending, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("candidateId", id);
    // Slight delay to prevent the dragged ghost image from disappearing if we modify state immediately
    setTimeout(() => {
      // Optional drag style updates
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("candidateId");
    if (!id) return;
    
    setDraggedId(null);

    // Optimistic update
    const previousCandidates = [...candidates];
    setCandidates((prev: any) => prev.map((c: any) => c.id === id ? { ...c, stage: stageId } : c));

    startTransition(async () => {
      try {
        await updateCandidateStage(id, stageId);
        toast.success("Pipeline stage updated");
      } catch (error) {
        toast.error("Failed to update candidate stage");
        setCandidates(previousCandidates); // Revert on failure
      }
    });
  };

  return (
    <div className="flex h-full w-full overflow-x-auto p-6 gap-6 snap-x pb-8">
      {STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c: any) => c.stage === stage.id);
        
        return (
          <div 
            key={stage.id}
            className="flex-shrink-0 w-[320px] flex flex-col h-full bg-white/40 rounded-xl border border-neutral-200/60 snap-center shadow-sm"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className={`px-4 py-3 border-b rounded-t-xl flex items-center justify-between shadow-sm ${stage.color}`}>
              <h3 className="font-semibold text-sm uppercase tracking-wider">{stage.label}</h3>
              <Badge variant="secondary" className="bg-white/60 text-inherit font-bold border-none shadow-sm">
                {stageCandidates.length}
              </Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
              {stageCandidates.map((cand: any) => {
                const profile = cand.talentProfile;
                const user = profile.user;
                const experience = profile.experiences?.[0];
                const isDragging = draggedId === cand.id;

                return (
                  <div
                    key={cand.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, cand.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`bg-white border rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all duration-200 ${isDragging ? 'opacity-50 border-dashed border-blue-400 scale-95 shadow-none' : 'border-neutral-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-700 text-sm font-bold flex items-center justify-center shrink-0 border overflow-hidden shadow-inner">
                          {profile.profileImage ? (
                            <img src={profile.profileImage} alt={user.firstName} className="size-full object-cover" />
                          ) : (
                            `${user.firstName[0] || ""}${user.lastName[0] || ""}`
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-neutral-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">
                            {user.firstName} {user.lastName}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{profile.headline}</p>
                        </div>
                      </div>
                      <GripVertical className="size-4 text-neutral-300 shrink-0 mt-1 cursor-grab" />
                    </div>

                    <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                      {experience && (
                        <div className="flex items-center gap-2 text-xs text-neutral-600">
                          <Building2 className="size-3.5 text-neutral-400" />
                          <span className="truncate">{experience.title} at {experience.companyName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <MapPin className="size-3.5 text-neutral-400" />
                        <span className="truncate">{profile.city || profile.country || "Location not set"}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {profile.customSlug ? (
                        <Link 
                          href={`/${locale}/talent/${profile.customSlug}`}
                          className="flex-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium py-1.5 px-3 rounded-md border border-neutral-200 transition-colors text-center flex items-center justify-center gap-1.5"
                          target="_blank"
                        >
                          Profile <ExternalLink className="size-3" />
                        </Link>
                      ) : (
                        <div className="flex-1 bg-neutral-50 text-neutral-400 text-xs font-medium py-1.5 px-3 rounded-md border border-neutral-100 text-center">
                          Hidden
                        </div>
                      )}
                      <button className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-100 transition-colors shadow-sm bg-white">
                        <Mail className="size-3.5" />
                      </button>
                      <button className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-md border border-transparent hover:border-neutral-200 transition-colors shadow-sm bg-white">
                        <MoreVertical className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {stageCandidates.length === 0 && (
                <div className="h-24 border-2 border-dashed border-neutral-200/70 rounded-xl flex items-center justify-center text-neutral-400 text-sm font-medium bg-neutral-50/30">
                  Drop candidate here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
