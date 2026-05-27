import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root 404. Catches any URL that doesn't match a route — including
 * revoked share tokens, archived resumes, deleted ATS scans, and
 * candidate profiles with visibility turned off.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          The link may be wrong, the resource was removed, or the owner revoked public access.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild className="bg-teal-700 text-white hover:bg-teal-800">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/en/tools">Browse tools</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
