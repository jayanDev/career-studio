"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ExternalLink, GripVertical } from "lucide-react";
import type { JobApplicationStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { jobPriorityMeta, jobStatuses, jobStatusMeta, type JobApplicationCard, type JobTrackerStats } from "@/lib/job-tracker";
import { updateJobApplicationStatusAction } from "@/server/actions/job-tracker/job-applications";

type JobTrackerClientLabels = {
  kanban: string;
  list: string;
  analytics: string;
  updated: string;
  noApplications: string;
  company: string;
  role: string;
  status: string;
  priority: string;
  location: string;
  weeklyApplications: string;
  statusMix: string;
};

export function JobTrackerClient({
  initialApplications,
  stats,
  labels,
}: {
  initialApplications: JobApplicationCard[];
  stats: JobTrackerStats;
  labels: JobTrackerClientLabels;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [isPending, startTransition] = useTransition();
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        jobStatuses.map((status) => [status, applications.filter((application) => application.status === status)])
      ) as Record<JobApplicationStatus, JobApplicationCard[]>,
    [applications]
  );

  function onDragEnd(event: DragEndEvent) {
    const applicationId = String(event.active.id);
    const status = event.over?.id;
    if (!status || !jobStatuses.includes(status as JobApplicationStatus)) return;
    const newStatus = status as JobApplicationStatus;
    const current = applications.find((application) => application.id === applicationId);
    if (!current || current.status === newStatus) return;

    setApplications((items) => items.map((item) => (item.id === applicationId ? { ...item, status: newStatus } : item)));
    startTransition(async () => {
      const result = await updateJobApplicationStatusAction({ applicationId, status: newStatus });
      if (!result.success) {
        setApplications(initialApplications);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{labels.kanban}</CardTitle>
        </CardHeader>
        <CardContent>
          <DndContext onDragEnd={onDragEnd}>
            <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-4 2xl:grid-cols-8">
              {jobStatuses.map((status) => (
                <KanbanColumn key={status} status={status} applications={grouped[status]} disabled={isPending} labels={labels} />
              ))}
            </div>
          </DndContext>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{labels.list}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b text-left text-neutral-500">
                <tr>
                  <th className="py-3 font-medium">{labels.company}</th>
                  <th className="py-3 font-medium">{labels.role}</th>
                  <th className="py-3 font-medium">{labels.status}</th>
                  <th className="py-3 font-medium">{labels.priority}</th>
                  <th className="py-3 font-medium">{labels.location}</th>
                  <th className="py-3 font-medium">{labels.updated}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td className="py-3 font-medium text-neutral-950">
                      <div className="flex items-center gap-2">
                        {application.companyName}
                        {application.jobUrl ? (
                          <a href={application.jobUrl} className="text-teal-700" target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 text-neutral-700">{application.jobTitle}</td>
                    <td className="py-3">
                      <Badge variant="outline" className="rounded-md">{jobStatusMeta[application.status].label}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className={`rounded-md ${jobPriorityMeta[application.priority].className}`}>
                        {jobPriorityMeta[application.priority].label}
                      </Badge>
                    </td>
                    <td className="py-3 text-neutral-600">{application.location || "-"}</td>
                    <td className="py-3 text-neutral-500">{new Date(application.updatedAt).toLocaleDateString("en-LK")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {applications.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">{labels.noApplications}</div> : null}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{labels.analytics}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-neutral-700">{labels.weeklyApplications}</h3>
              <div className="mt-3 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeklyApplications}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-700">{labels.statusMix}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {jobStatuses.map((status) => (
                  <div key={status} className="rounded-md border bg-neutral-50 p-3">
                    <div className="text-lg font-semibold text-neutral-950">{stats.statusCounts[status]}</div>
                    <div className="text-xs text-neutral-500">{jobStatusMeta[status].label}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  applications,
  disabled,
  labels,
}: {
  status: JobApplicationStatus;
  applications: JobApplicationCard[];
  disabled: boolean;
  labels: JobTrackerClientLabels;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });

  return (
    <section ref={setNodeRef} className={`min-h-72 min-w-72 rounded-lg border bg-neutral-50 p-3 ${isOver ? "ring-2 ring-teal-500" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-neutral-950">{jobStatusMeta[status].label}</h3>
        <Badge variant="outline" className="rounded-md">{applications.length}</Badge>
      </div>
      <div className="space-y-3">
        {applications.map((application) => (
          <KanbanCard key={application.id} application={application} />
        ))}
        {applications.length === 0 ? <div className="rounded-md border border-dashed bg-white p-4 text-center text-xs text-neutral-500">{labels.noApplications}</div> : null}
      </div>
    </section>
  );
}

function KanbanCard({ application }: { application: JobApplicationCard }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: application.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const reminder = useMemo(() => {
    if (!application.followUpDate) return null;
    if (["accepted", "rejected", "withdrew"].includes(application.status)) return null;

    const followUpDate = new Date(application.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    followUpDate.setHours(0, 0, 0, 0);

    const diffTime = followUpDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: "Follow-up Overdue",
        className: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-semibold",
      };
    } else if (diffDays === 0) {
      return {
        label: "Follow-up Today",
        className: "bg-amber-50 text-amber-800 border-amber-300 font-semibold animate-pulse",
      };
    } else if (diffDays <= 3) {
      return {
        label: `Follow-up in ${diffDays}d`,
        className: "bg-sky-50 text-sky-800 border-sky-200 font-medium",
      };
    }
    return null;
  }, [application.followUpDate, application.status]);

  return (
    <article ref={setNodeRef} style={style} className="rounded-md border bg-white p-3 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-neutral-950 text-sm">{application.jobTitle}</h4>
          <p className="mt-1 text-xs text-neutral-500">{application.companyName}</p>
        </div>
        <button type="button" className="text-neutral-400 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} aria-label="Drag card">
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline" className={`rounded-md text-[10px] py-0.5 px-1.5 ${jobPriorityMeta[application.priority].className}`}>
          {jobPriorityMeta[application.priority].label}
        </Badge>
        {reminder ? (
          <Badge variant="outline" className={`rounded-md text-[10px] py-0.5 px-1.5 flex items-center gap-1 border ${reminder.className}`}>
            <CalendarClock className="size-3" />
            {reminder.label}
          </Badge>
        ) : application.followUpDate ? (
          <Badge variant="outline" className="rounded-md text-[10px] py-0.5 px-1.5 flex items-center gap-1 border-neutral-200 text-neutral-600 bg-neutral-50">
            <CalendarClock className="size-3" />
            {application.followUpDate}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}
