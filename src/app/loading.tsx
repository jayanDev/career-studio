import { Loader2 } from "lucide-react";

/**
 * Root loading skeleton. Renders while route segments are streaming
 * in. Per-route loading.tsx files can override this when the screen
 * needs a richer skeleton.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <Loader2 className="size-8 animate-spin text-teal-700" />
    </div>
  );
}
