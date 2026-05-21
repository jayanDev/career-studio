import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { interpretScore, type AtsScoreResult } from "@/lib/ats-scoring";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const resultId = searchParams.get("resultId");

  if (!resultId) {
    return new Response("Result ID is required", { status: 400 });
  }

  try {
    const result = await prisma.aTSCheckResult.findUnique({
      where: { id: resultId },
      include: {
        cvDocument: true,
      },
    });

    if (!result || result.cvDocument.userId !== session.user.id) {
      return new Response("Not Found", { status: 404 });
    }

    const scoresObj = (result.scores || {}) as any;
    const issuesList = (result.issues || []) as string[];
    const suggestionsList = (result.suggestions || []) as string[];
    const matchingKeywords = (scoresObj.matchingKeywords || []) as string[];
    const missingKeywords = (scoresObj.missingKeywords || []) as string[];
    const interpretation = interpretScore(result.overallScore);

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ATS Evaluation Report - ${result.cvDocument.filename}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background-color: white !important; color: black !important; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body class="bg-neutral-50 text-neutral-900 p-8 font-sans">
  <div class="max-w-4xl mx-auto bg-white border border-neutral-200 rounded-lg p-8 shadow-xs">
    <!-- Header -->
    <div class="flex justify-between items-center border-b pb-6 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-teal-800">ATS Evaluation Report</h1>
        <p class="text-sm text-neutral-500 mt-1">Document: ${result.cvDocument.filename} • Checked on ${new Date(result.createdAt).toLocaleDateString()}</p>
      </div>
      <button onclick="window.print()" class="no-print bg-teal-700 hover:bg-teal-800 text-white font-medium py-2 px-4 rounded text-sm shadow-xs transition">
        Print / Save PDF
      </button>
    </div>

    <!-- Overall Gauge -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b pb-6">
      <div class="flex flex-col items-center justify-center p-6 bg-teal-50 border border-teal-100 rounded-lg text-center">
        <span class="text-xs font-semibold text-teal-600 uppercase tracking-wider">Overall Score</span>
        <span class="text-5xl font-extrabold text-teal-800 mt-2">${result.overallScore} / 100</span>
        <span class="mt-2 text-xs font-semibold px-2.5 py-0.5 rounded bg-teal-100 text-teal-900">${interpretation.label}</span>
      </div>
      
      <div class="col-span-2 grid grid-cols-2 gap-4">
        <div class="p-4 border rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Format Score</div>
          <div class="text-lg font-bold mt-1 text-neutral-950">${result.formatScore} / 25</div>
        </div>
        <div class="p-4 border rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Content Score</div>
          <div class="text-lg font-bold mt-1 text-neutral-950">${result.contentScore} / 25</div>
        </div>
        <div class="p-4 border rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Keywords Score</div>
          <div class="text-lg font-bold mt-1 text-neutral-950">${result.keywordsScore} / 25</div>
        </div>
        <div class="p-4 border rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Length Score</div>
          <div class="text-lg font-bold mt-1 text-neutral-950">${result.lengthScore} / 25</div>
        </div>
      </div>
    </div>

    <!-- Keyword match -->
    ${result.jdKeywordMatchPct !== null ? `
    <div class="mb-8 border-b pb-6">
      <h2 class="text-lg font-bold text-neutral-950 mb-3">Job Description Fit</h2>
      <div class="w-full bg-neutral-200 rounded-full h-3 mb-2">
        <div class="bg-amber-600 h-3 rounded-full" style="width: ${result.jdKeywordMatchPct}%"></div>
      </div>
      <p class="text-sm font-semibold text-amber-800">Keyword Match: ${result.jdKeywordMatchPct}%</p>
    </div>
    ` : ""}

    <!-- Keywords -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b pb-6">
      <div>
        <h3 class="text-sm font-bold text-teal-800 mb-2">Matching Keywords (${matchingKeywords.length})</h3>
        <div class="flex flex-wrap gap-1.5">
          ${matchingKeywords.length > 0 ? matchingKeywords.map(k => `<span class="bg-teal-50 border border-teal-200 text-teal-800 text-xs px-2 py-0.5 rounded font-medium">${k}</span>`).join(" ") : `<span class="text-xs text-neutral-500">None found</span>`}
        </div>
      </div>
      <div>
        <h3 class="text-sm font-bold text-rose-800 mb-2">Missing Keywords (${missingKeywords.length})</h3>
        <div class="flex flex-wrap gap-1.5">
          ${missingKeywords.length > 0 ? missingKeywords.map(k => `<span class="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-2 py-0.5 rounded font-medium">${k}</span>`).join(" ") : `<span class="text-xs text-neutral-500">None missing</span>`}
        </div>
      </div>
    </div>

    <!-- Issues & Suggestions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div>
        <h2 class="text-md font-bold text-neutral-900 border-b pb-2 mb-3">Flagged Issues</h2>
        <ul class="list-disc pl-5 text-sm space-y-1.5 text-neutral-700">
          ${issuesList.length > 0 ? issuesList.map(i => `<li>${i}</li>`).join("") : "<li>No major issues flagged</li>"}
        </ul>
      </div>
      <div>
        <h2 class="text-md font-bold text-neutral-900 border-b pb-2 mb-3">Improvement Actions</h2>
        <ul class="list-disc pl-5 text-sm space-y-1.5 text-neutral-700">
          ${suggestionsList.length > 0 ? suggestionsList.map(s => `<li>${s}</li>`).join("") : "<li>No major recommendations</li>"}
        </ul>
      </div>
    </div>

    <!-- Sri Lanka Context Metrics -->
    ${scoresObj.sriLankaContext ? `
    <div class="page-break mt-12 pt-8 border-t">
      <h2 class="text-lg font-bold text-teal-800 mb-4">Sri Lanka MOAT Analysis</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Local Universities</div>
          <div class="text-sm font-bold mt-1 text-neutral-950">${scoresObj.sriLankaContext.recognizedUniversities.length > 0 ? scoresObj.sriLankaContext.recognizedUniversities.join(", ") : "None detected"}</div>
        </div>
        <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Local Companies</div>
          <div class="text-sm font-bold mt-1 text-neutral-950">${scoresObj.sriLankaContext.recognizedCompanies.length > 0 ? scoresObj.sriLankaContext.recognizedCompanies.join(", ") : "None detected"}</div>
        </div>
        <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-md">
          <div class="text-xs text-neutral-500 font-semibold uppercase">Professional Certifications</div>
          <div class="text-sm font-bold mt-1 text-neutral-950">${scoresObj.sriLankaContext.recognizedCerts.length > 0 ? scoresObj.sriLankaContext.recognizedCerts.join(", ") : "None detected"}</div>
        </div>
      </div>
      <div class="bg-teal-50 border border-teal-100 rounded-lg p-4">
        <h4 class="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Sri Lankan Market Placement Tips</h4>
        <ul class="list-disc pl-5 text-sm space-y-1 text-teal-900">
          ${scoresObj.sriLankaContext.tips.map((t: string) => `<li>${t}</li>`).join("")}
        </ul>
      </div>
    </div>
    ` : ""}

    <!-- Formatting Hazards -->
    ${scoresObj.formattingHazards ? `
    <div class="mt-8 border-t pt-6">
      <h2 class="text-lg font-bold text-rose-800 mb-3">Formatting Hazards</h2>
      <ul class="list-disc pl-5 text-sm space-y-1.5 text-rose-950">
        ${scoresObj.formattingHazards.issues.map((i: string) => `<li>${i}</li>`).join("")}
        ${scoresObj.formattingHazards.issues.length === 0 ? "<li>No major formatting issues detected</li>" : ""}
      </ul>
    </div>
    ` : ""}
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>
    `;

    return new Response(htmlContent, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("Failed to generate PDF view:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
