import { FeedbackType } from "@prisma/client";
import { MessageSquarePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n-config";
import { createFeedbackAction } from "@/server/actions/feedback/feedback";

export async function FeedbackWidget({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "phase6.feedback" });
  const action = createFeedbackAction.bind(null, locale);

  return (
    <details className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))] rounded-lg border bg-white shadow-lg">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-neutral-950">
        <MessageSquarePlus className="size-4 text-teal-700" />
        {t("title")}
      </summary>
      <form action={action} className="space-y-3 border-t p-4">
        <select name="type" defaultValue={FeedbackType.improvement} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
          <option value={FeedbackType.bug}>{t("bug")}</option>
          <option value={FeedbackType.feature}>{t("feature")}</option>
          <option value={FeedbackType.improvement}>{t("improvement")}</option>
          <option value={FeedbackType.other}>{t("other")}</option>
        </select>
        <Input name="title" placeholder={t("titlePlaceholder")} required />
        <Textarea name="message" placeholder={t("messagePlaceholder")} required />
        <Button type="submit" className="w-full bg-teal-700 text-white hover:bg-teal-800">
          {t("send")}
        </Button>
      </form>
    </details>
  );
}
