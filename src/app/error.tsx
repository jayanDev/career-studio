"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Caught by Next.js when any server or client
 * component throws above the route segment. We deliberately don't leak
 * the error message to the UI — production users see a friendly
 * page; details still go to the console for the dev tools panel.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[root-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          We hit an unexpected error
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          The team has been notified. You can try again, or head back to the home page if this keeps happening.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] font-mono text-neutral-400">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()} className="bg-teal-700 text-white hover:bg-teal-800">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
