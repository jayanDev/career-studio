import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const importJobSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  jobUrl: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  salaryRange: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  tags: z.string().trim().optional().default(""),
  recruiterName: z.string().trim().optional().default(""),
  recruiterEmail: z.string().trim().optional().default(""),
  recruiterPhone: z.string().trim().optional().default(""),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const result = importJobSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid job details", details: result.error.format() },
        { status: 400 }
      );
    }

    const { data } = result;

    const jobApplication = await prisma.jobApplication.create({
      data: {
        userId: session.user.id,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        jobUrl: data.jobUrl,
        location: data.location,
        salaryRange: data.salaryRange,
        notes: data.notes,
        tags: data.tags ? `${data.tags}, imported` : "imported",
        recruiterName: data.recruiterName,
        recruiterEmail: data.recruiterEmail,
        recruiterPhone: data.recruiterPhone,
        status: "bookmarked",
        priority: "medium",
      },
    });

    return NextResponse.json({ success: true, data: jobApplication }, { status: 201 });
  } catch (error) {
    console.error("Failed to import job:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
