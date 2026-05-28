"use client";

/**
 * GDPR delete-account card. Renders in Settings → Account.
 *
 * Two-step confirmation: the destructive action is gated behind typing
 * the candidate's email exactly. The action runs inside a transaction
 * server-side; we don't optimistically remove anything in the client.
 */

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteAccountAction } from "@/server/actions/account/delete-account";

export function DeleteAccountCard({ accountEmail }: { accountEmail: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = confirmation.trim().toLowerCase() === accountEmail.toLowerCase();

  function submit() {
    if (!ready) {
      setError("Email doesn't match — type it exactly to confirm.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccountAction({
          confirmationEmail: confirmation,
          reason: reason.trim() || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Account deletion failed");
      }
    });
  }

  return (
    <Card className="border-rose-200 bg-rose-50/30">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="size-4 text-rose-700" />
        <CardTitle className="text-rose-900">Delete account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-rose-900/80">
          Permanently deletes your account and every resume, cover letter, ATS scan, LinkedIn audit,
          career plan, talent profile, recruiter project, subscription, and message tied to it. This
          cannot be undone.
        </p>

        {!open ? (
          <Button
            type="button"
            variant="outline"
            className="border-rose-300 text-rose-900 hover:bg-rose-100"
            onClick={() => setOpen(true)}
          >
            Start deletion
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-rose-200 bg-white p-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-rose-900">
                Type your email to confirm
              </Label>
              <Input
                type="email"
                placeholder={accountEmail}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1"
                disabled={isPending}
                autoComplete="off"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Why are you leaving? (optional)
              </Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="We read every reason. Skip if you'd rather not say."
                className="mt-1"
                disabled={isPending}
              />
            </div>

            {error ? <p className="text-xs text-rose-700">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setConfirmation("");
                  setReason("");
                  setError(null);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={!ready || isPending}
                className="bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Permanently delete account
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
