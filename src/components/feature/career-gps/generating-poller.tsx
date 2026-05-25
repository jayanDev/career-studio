"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function GeneratingPoller({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    async function checkStatus() {
      try {
        const res = await fetch(`/api/career-gps/status?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "GENERATED" && data.planId) {
            router.push(`/en/career-gps?plan=${data.planId}`);
            return;
          }
        }
      } catch (err) {
        // ignore
      }
      timeoutId = setTimeout(checkStatus, 3000);
    }
    
    checkStatus();
    
    return () => clearTimeout(timeoutId);
  }, [sessionId, router]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed bg-white">
      <Loader2 className="size-10 animate-spin text-teal-700" />
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">Generating your Career GPS Roadmap...</h2>
      <p className="mt-2 text-sm text-neutral-600">Our AI is analyzing your profile, evaluating skill gaps, and plotting pathways.</p>
      <p className="mt-1 text-xs text-neutral-500">This usually takes about 10-15 seconds.</p>
    </div>
  );
}
