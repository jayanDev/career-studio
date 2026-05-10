"use server";

import { redirect } from "next/navigation";
import { Prisma, SalaryExperienceLevel } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { convertCurrency, DEFAULT_CURRENCY, formatCurrency, type SupportedCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

const supportedCurrencies = ["LKR", "USD", "EUR", "GBP", "INR"] as const;

const calculateSalarySchema = z.object({
  jobTitle: z.string().trim().min(2).max(200),
  experienceLevel: z.nativeEnum(SalaryExperienceLevel),
  city: z.string().trim().min(2).max(100),
  compareCity: z.string().trim().max(100).optional().default(""),
  currency: z.enum(supportedCurrencies).default(DEFAULT_CURRENCY),
});

export type SalaryResult = {
  min: number;
  max: number;
  median: number;
  formattedMedian: string;
  sampleSize: number;
  currency: SupportedCurrency;
  colAdjustedMedian: number | null;
  formattedColAdjustedMedian: string | null;
  fromIndex: number | null;
  toIndex: number | null;
  privacyMessage: string | null;
};

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/en/auth/sign-in");
  }

  return session.user;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || typeof value === "undefined") return 0;
  return Number(value);
}

function asSupportedCurrency(value: string): SupportedCurrency {
  return supportedCurrencies.includes(value as SupportedCurrency) ? (value as SupportedCurrency) : DEFAULT_CURRENCY;
}

export async function calculateSalaryAction(input: z.infer<typeof calculateSalarySchema>): Promise<SalaryResult> {
  const user = await requireUser();
  const parsed = calculateSalarySchema.parse(input);
  const rows = await prisma.salaryData.findMany({
    where: {
      jobTitle: { contains: parsed.jobTitle, mode: "insensitive" },
      experienceLevel: parsed.experienceLevel,
      country: "Sri Lanka",
      OR: [
        { city: { contains: parsed.city, mode: "insensitive" } },
        { state: { contains: parsed.city, mode: "insensitive" } },
      ],
    },
    take: 25,
  });
  const fallbackRows = rows.length
    ? rows
    : await prisma.salaryData.findMany({
        where: {
          jobTitle: { contains: parsed.jobTitle, mode: "insensitive" },
          experienceLevel: parsed.experienceLevel,
          country: "Sri Lanka",
        },
        take: 25,
      });
  const sampleSize = fallbackRows.reduce((sum, row) => sum + Math.max(row.sampleSize, 1), 0);

  if (sampleSize < 3 || fallbackRows.length === 0) {
    return {
      min: 0,
      max: 0,
      median: 0,
      formattedMedian: formatCurrency(0, parsed.currency),
      sampleSize,
      currency: parsed.currency,
      colAdjustedMedian: null,
      formattedColAdjustedMedian: null,
      fromIndex: null,
      toIndex: null,
      privacyMessage: "Insufficient data to display; at least 3 samples are needed to protect individual privacy.",
    };
  }

  const normalized = fallbackRows.map((row) => {
    const sourceCurrency = asSupportedCurrency(row.currency);
    const salaryMin = convertCurrency(toNumber(row.salaryMin), sourceCurrency, parsed.currency);
    const salaryMax = convertCurrency(toNumber(row.salaryMax), sourceCurrency, parsed.currency);
    const salaryMedian = convertCurrency(toNumber(row.salaryMedian) || (toNumber(row.salaryMin) + toNumber(row.salaryMax)) / 2, sourceCurrency, parsed.currency);
    return { salaryMin, salaryMax, salaryMedian };
  });
  const min = Math.round(Math.min(...normalized.map((row) => row.salaryMin)));
  const max = Math.round(Math.max(...normalized.map((row) => row.salaryMax)));
  const median = Math.round(normalized.reduce((sum, row) => sum + row.salaryMedian, 0) / normalized.length);
  const [fromCol, toCol] = await Promise.all([
    prisma.costOfLivingData.findFirst({ where: { city: { contains: parsed.city, mode: "insensitive" }, country: "Sri Lanka" } }),
    parsed.compareCity ? prisma.costOfLivingData.findFirst({ where: { city: { contains: parsed.compareCity, mode: "insensitive" }, country: "Sri Lanka" } }) : Promise.resolve(null),
  ]);
  const colAdjustedMedian = fromCol && toCol ? Math.round((median * toCol.overallIndex) / fromCol.overallIndex) : null;

  await prisma.salaryCalculation.create({
    data: {
      userId: user.id,
      jobTitle: parsed.jobTitle,
      experienceLevel: parsed.experienceLevel,
      location: parsed.city,
      salaryMin: min,
      salaryMax: max,
      salaryMedian: median,
      percentile25: Math.round(min + (median - min) * 0.5),
      percentile75: Math.round(median + (max - median) * 0.5),
    },
  });

  return {
    min,
    max,
    median,
    formattedMedian: formatCurrency(median, parsed.currency),
    sampleSize,
    currency: parsed.currency,
    colAdjustedMedian,
    formattedColAdjustedMedian: colAdjustedMedian ? formatCurrency(colAdjustedMedian, parsed.currency) : null,
    fromIndex: fromCol?.overallIndex ?? null,
    toIndex: toCol?.overallIndex ?? null,
    privacyMessage: null,
  };
}
