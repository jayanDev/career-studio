"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2, Radio, Sparkles, Mic, MicOff, RefreshCw, User, MessageSquareCode, Volume2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { InterviewFeedbackResult } from "@/server/actions/interview/practice";
import { submitInterviewTurnAction } from "@/server/actions/interview/practice";

type PracticeQuestion = {
  id: string;
  questionText: string;
  category: string;
};

type ChatMessage = {
  role: "interviewer" | "candidate";
  text: string;
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
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [feedbacks, setFeedbacks] = useState<InterviewFeedbackResult[]>([]);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const selected = questions.find((question) => question.id === questionId);

  // Initialize history when question changes
  useEffect(() => {
    if (selected) {
      setHistory([
        { role: "interviewer", text: selected.questionText }
      ]);
      setFeedbacks([]);
      setCurrentTurn(1);
      setSessionCompleted(false);
      setAnswer("");
      stopRecording();
    }
  }, [questionId]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Web Speech API support
  const SpeechRecognition = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const isSpeechSupported = !!SpeechRecognition;

  function startRecording() {
    if (!isSpeechSupported) return;
    setIsRecording(true);
    setRecordingSeconds(0);
    
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalTranscript = "";

    rec.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setAnswer((finalTranscript + interimTranscript).trim());
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      stopRecording();
    };

    rec.onend = () => {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // Local text/speech stats analysis
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const fillerWords = ["um", "uh", "like", "actually", "basically", "you know", "ah", "so"];
  let fillerCount = 0;
  if (answer.trim()) {
    fillerWords.forEach((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedWord}\\b`, "gi");
      const matches = answer.match(regex);
      if (matches) {
        fillerCount += matches.length;
      }
    });
  }

  const wpm = recordingSeconds > 1 ? Math.round((wordCount / recordingSeconds) * 60) : 0;

  function submitTurn() {
    if (!questionId || !answer.trim()) return;
    
    stopRecording();
    const candidateAnswer = answer;
    const currentHistory = [...history];

    startTransition(async () => {
      // Append candidate response to chat history immediately for rendering
      setHistory(prev => [...prev, { role: "candidate", text: candidateAnswer }]);

      const isFinal = currentTurn >= 3;
      const response = await submitInterviewTurnAction({
        questionId,
        answer: candidateAnswer,
        history: currentHistory,
        timeTaken: recordingSeconds,
        isFinalTurn: isFinal
      });

      setFeedbacks(prev => [...prev, response.feedback]);

      if (response.followUpQuestion && !isFinal) {
        setHistory(prev => [...prev, { role: "interviewer", text: response.followUpQuestion! }]);
        setCurrentTurn(prev => prev + 1);
        setAnswer("");
      } else {
        setSessionCompleted(true);
      }
    });
  }

  function resetSession() {
    if (selected) {
      setHistory([
        { role: "interviewer", text: selected.questionText }
      ]);
      setFeedbacks([]);
      setCurrentTurn(1);
      setSessionCompleted(false);
      setAnswer("");
      stopRecording();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="bg-white shadow-sm border border-neutral-100 flex flex-col justify-between">
        <CardHeader className="border-b bg-neutral-50/50 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle>{labels.practiceTitle}</CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">Conversational AI Mock Interview Session</p>
          </div>
          <Badge className="bg-teal-700 text-white rounded-md">
            {sessionCompleted ? "Session Completed" : `Turn ${currentTurn} of 3`}
          </Badge>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6 flex-1 flex flex-col justify-between">
          {/* Conversational Chat Box */}
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 mb-6 scrollbar-thin">
            {history.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}>
                {msg.role !== "candidate" && (
                  <div className="size-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
                    <Radio className="size-4 animate-pulse" />
                  </div>
                )}
                <div className={`rounded-xl p-3.5 max-w-[85%] text-sm leading-6 shadow-xs ${
                  msg.role === "candidate" 
                    ? "bg-teal-700 text-white rounded-tr-none" 
                    : "bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-none"
                }`}>
                  <div className="font-semibold text-xs mb-1 opacity-75">
                    {msg.role === "candidate" ? "You (Candidate)" : "Interviewer (AI Coach)"}
                  </div>
                  <div>{msg.text}</div>
                </div>
                {msg.role === "candidate" && (
                  <div className="size-8 rounded-full bg-teal-800 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            ))}
            {isPending && (
              <div className="flex gap-3 justify-start items-center">
                <div className="size-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                  <Loader2 className="size-4 animate-spin" />
                </div>
                <div className="text-xs text-neutral-400 font-medium">Interviewer is evaluating and formulating response...</div>
              </div>
            )}
          </div>

          {!sessionCompleted ? (
            <div className="space-y-4">
              <div className="relative">
                <Textarea 
                  rows={5} 
                  value={answer} 
                  onChange={(event) => setAnswer(event.target.value)} 
                  placeholder={labels.answerPlaceholder} 
                  disabled={isPending}
                  className="pr-12 text-sm"
                />
                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isPending}
                    className={`absolute bottom-3 right-3 p-2 rounded-full border transition-all ${
                      isRecording 
                        ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse hover:bg-rose-100" 
                        : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                )}
              </div>

              {/* Speech & Analysis Dashboard */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5 text-center shadow-xs">
                  <div className="text-xs font-semibold text-neutral-500">Timer</div>
                  <div className="text-sm font-bold text-neutral-900 mt-0.5">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5 text-center shadow-xs">
                  <div className="text-xs font-semibold text-neutral-500">Filler Words</div>
                  <div className={`text-sm font-bold mt-0.5 ${fillerCount > 3 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fillerCount}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5 text-center shadow-xs">
                  <div className="text-xs font-semibold text-neutral-500">Speech Rate</div>
                  <div className="text-sm font-bold text-neutral-900 mt-0.5">
                    {wpm > 0 ? `${wpm} WPM` : "-"}
                  </div>
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  className="bg-teal-700 text-white hover:bg-teal-800" 
                  disabled={isPending || !answer.trim()} 
                  onClick={submitTurn}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Submit Answer
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-6 text-center space-y-3">
              <CheckCircle2 className="size-10 text-teal-600 mx-auto" />
              <div>
                <h4 className="font-semibold text-neutral-950 text-base">Session Finished!</h4>
                <p className="text-sm text-neutral-500 mt-1">You have completed all 3 turns. Review your overall feedback on the right panel.</p>
              </div>
              <Button type="button" variant="outline" className="border-teal-700 text-teal-700 hover:bg-teal-50" onClick={resetSession}>
                <RefreshCw className="size-4" />
                Practice Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structured Coaching Feedback Side Panel */}
      <Card className="bg-white shadow-sm border border-neutral-100">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-lg">Interview Coach Feedback</CardTitle>
          <p className="text-xs text-neutral-500">Evaluations updated dynamically after each response</p>
        </CardHeader>
        <CardContent className="p-6">
          {feedbacks.length > 0 ? (
            <div className="space-y-6">
              {/* Score summary */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="size-14 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center text-teal-800 font-extrabold text-xl shadow-xs">
                  {feedbacks[feedbacks.length - 1].score}/10
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Current Turn Evaluation</div>
                  <div className="text-xs text-neutral-500">Turn {feedbacks.length} performance details</div>
                </div>
              </div>

              <div className="space-y-4">
                <FeedbackList title={labels.strengths} items={feedbacks[feedbacks.length - 1].strengths} fallback="Well structured response." />
                <FeedbackList title={labels.improvements} items={feedbacks[feedbacks.length - 1].improvements} fallback="Clear answers. No major improvements identified." />
                <FeedbackList title={labels.tips} items={feedbacks[feedbacks.length - 1].tips} fallback="Apply the STAR methodology." />
                
                {feedbacks[feedbacks.length - 1].sample_answer && (
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 shadow-xs">
                    <h3 className="font-semibold text-sm text-neutral-900 mb-1">{labels.sampleAnswer}</h3>
                    <p className="text-xs leading-5 text-neutral-600 italic">"{feedbacks[feedbacks.length - 1].sample_answer}"</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400">
              Your feedback summary will display here once you submit your first answer. Use the mic to record or type.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FeedbackList({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 shadow-xs">
      <h3 className="font-semibold text-sm text-neutral-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-neutral-600">
        {items.length ? items.map((item, idx) => <li key={idx}>{item}</li>) : <li>{fallback}</li>}
      </ul>
    </div>
  );
}
