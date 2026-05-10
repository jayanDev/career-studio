"use client";

import { useState, useTransition } from "react";
import { Loader2, Radio, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { InterviewFeedbackResult } from "@/server/actions/interview/practice";
import { submitInterviewAnswerAction } from "@/server/actions/interview/practice";

type PracticeQuestion = {
  id: string;
  questionText: string;
  category: string;
};

export function InterviewPracticeClient({
  questions,
  labels,
}: {
  questions: PracticeQuestion[];
  labels: {
    practiceTitle: string;
    answerPlaceholder: string;
    getFeedback: string;
    streamFeedback: string;
    score: string;
    strengths: string;
    improvements: string;
    tips: string;
    sampleAnswer: string;
  };
}) {
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? "");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedbackResult | null>(null);
  const [streamed, setStreamed] = useState("");
  const [isPending, startTransition] = useTransition();
  const selected = questions.find((question) => question.id === questionId);

  function submitStructuredFeedback() {
    if (!questionId || !answer.trim()) return;
    startTransition(async () => {
      setFeedback(await submitInterviewAnswerAction({ questionId, answer, timeTaken: 0 }));
    });
  }

  async function streamCoaching() {
    if (!selected || !answer.trim()) return;
    setStreamed("");
    const response = await fetch("/api/ai/interview-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: selected.questionText, category: selected.category, answer }),
    });
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) setStreamed((current) => `${current}${decoder.decode(result.value)}`);
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>{labels.practiceTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <select value={questionId} onChange={(event) => setQuestionId(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
          {questions.map((question) => (
            <option key={question.id} value={question.id}>{question.questionText}</option>
          ))}
        </select>
        <Textarea rows={7} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={labels.answerPlaceholder} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="bg-teal-700 text-white hover:bg-teal-800" disabled={isPending || !answer.trim()} onClick={submitStructuredFeedback}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {labels.getFeedback}
          </Button>
          <Button type="button" variant="outline" disabled={!answer.trim()} onClick={streamCoaching}>
            <Radio className="size-4" />
            {labels.streamFeedback}
          </Button>
        </div>
        {streamed ? <div className="whitespace-pre-wrap rounded-md border bg-teal-50 p-4 text-sm leading-6 text-teal-950">{streamed}</div> : null}
        {feedback ? (
          <div className="grid gap-3 md:grid-cols-2">
            <FeedbackList title={`${labels.score}: ${feedback.score}/10`} items={feedback.strengths} fallback={labels.strengths} />
            <FeedbackList title={labels.improvements} items={feedback.improvements} fallback={labels.improvements} />
            <FeedbackList title={labels.tips} items={feedback.tips} fallback={labels.tips} />
            <div className="rounded-md border bg-neutral-50 p-4">
              <h3 className="font-semibold text-neutral-950">{labels.sampleAnswer}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{feedback.sample_answer || "-"}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeedbackList({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-md border bg-neutral-50 p-4">
      <h3 className="font-semibold text-neutral-950">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>{fallback}</li>}
      </ul>
    </div>
  );
}
