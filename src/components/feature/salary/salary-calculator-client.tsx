"use client";

import { useState, useTransition } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { SalaryExperienceLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateSalaryAction, type SalaryResult } from "@/server/actions/salary/calculate";

export function SalaryCalculatorClient({
  jobTitles,
  cities,
  labels,
}: {
  jobTitles: string[];
  cities: string[];
  labels: {
    calculatorTitle: string;
    jobTitle: string;
    experience: string;
    city: string;
    compareCity: string;
    currency: string;
    calculate: string;
    result: string;
    median: string;
    range: string;
    sampleSize: string;
    colAdjusted: string;
  };
}) {
  const [jobTitle, setJobTitle] = useState(jobTitles[0] ?? "");
  const [experienceLevel, setExperienceLevel] = useState<SalaryExperienceLevel>(SalaryExperienceLevel.mid);
  const [city, setCity] = useState(cities[0] ?? "Colombo");
  const [compareCity, setCompareCity] = useState(cities[1] ?? "Kandy");
  const [currency, setCurrency] = useState<"LKR" | "USD" | "EUR" | "GBP" | "INR">("LKR");
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function calculate() {
    startTransition(async () => {
      setResult(await calculateSalaryAction({ jobTitle, experienceLevel, city, compareCity, currency }));
    });
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>{labels.calculatorTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label={labels.jobTitle}>
            <Input list="salary-job-titles" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            <datalist id="salary-job-titles">{jobTitles.map((title) => <option key={title} value={title} />)}</datalist>
          </Field>
          <Field label={labels.experience}>
            <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value as SalaryExperienceLevel)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              {Object.values(SalaryExperienceLevel).map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </Field>
          <Field label={labels.city}>
            <Input list="salary-cities" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
          <Field label={labels.compareCity}>
            <Input list="salary-cities" value={compareCity} onChange={(event) => setCompareCity(event.target.value)} />
            <datalist id="salary-cities">{cities.map((item) => <option key={item} value={item} />)}</datalist>
          </Field>
          <Field label={labels.currency}>
            <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              {["LKR", "USD", "EUR", "GBP", "INR"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="button" className="w-full bg-teal-700 text-white hover:bg-teal-800" disabled={isPending || !jobTitle || !city} onClick={calculate}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              {labels.calculate}
            </Button>
          </div>
        </div>

        {result ? (
          <div className="rounded-lg border bg-neutral-50 p-5">
            {result.privacyMessage ? (
              <p className="text-sm text-neutral-600">{result.privacyMessage}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                <Metric label={labels.median} value={result.formattedMedian} />
                <Metric label={labels.range} value={`${result.min.toLocaleString("en-LK")} - ${result.max.toLocaleString("en-LK")}`} />
                <Metric label={labels.sampleSize} value={String(result.sampleSize)} />
                <Metric label={labels.colAdjusted} value={result.formattedColAdjustedMedian ?? "-"} />
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium text-neutral-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-semibold text-neutral-950">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}
