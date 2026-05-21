import type { ResumeContent, ResumeSectionKey } from "@/lib/resume-content";
import { cn } from "@/lib/utils";

const sectionTitles: Record<ResumeSectionKey, string> = {
  header: "",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

export function ResumePreview({
  content,
  className,
  visual = "document",
  talentSlug,
  locale = "en",
}: {
  content: ResumeContent;
  className?: string;
  visual?: "document" | "graphic";
  talentSlug?: string;
  locale?: string;
}) {
  const printStyles = `
    @media print {
      html, body {
        height: auto;
        font-size: 11pt;
        background: #fff !important;
        color: #000 !important;
      }
      header, footer, nav, aside, form, button, .no-print, [role="button"] {
        display: none !important;
      }
      @page {
        size: A4 portrait;
        margin: 15mm;
      }
      body * {
        visibility: hidden;
      }
      #resume-print-area, #resume-print-area * {
        visibility: visible;
      }
      #resume-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100% !important;
        max-width: 100% !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    }
  `;

  return (
    <article id="resume-print-area" className={cn("min-h-[720px] rounded-lg border bg-white p-8 text-neutral-950 shadow-sm", className)}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      {content.sectionOrder.map((section) => {
        if (section === "header") {
          const profileUrl = typeof window !== "undefined" && talentSlug
            ? `${window.location.origin}/${locale}/talent/${talentSlug}`
            : "";
          const qrCodeUrl = profileUrl
            ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(profileUrl)}`
            : null;

          return (
            <header key={section} className={cn("border-b pb-5 flex justify-between items-start gap-4", visual === "graphic" && "rounded-md bg-teal-50 p-5")}>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">{content.header.fullName || "Your Name"}</h2>
                <p className="mt-1 text-base text-teal-800">{content.header.title || "Target role"}</p>
                <p className="mt-3 text-sm text-neutral-600">
                  {[content.header.email, content.header.phone, content.header.location, content.header.linkedin].filter(Boolean).join(" | ")}
                </p>
              </div>
              {qrCodeUrl && (
                <div className="flex flex-col items-center gap-1 shrink-0 text-center">
                  <img src={qrCodeUrl} alt="Talent Profile QR Code" className="size-16 rounded border bg-white p-0.5 shadow-sm" />
                  <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Scan Profile</span>
                </div>
              )}
            </header>
          );
        }

        return (
          <section key={section} className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-800">{sectionTitles[section]}</h3>
            <div className="mt-3">{renderSection(section, content)}</div>
          </section>
        );
      })}
    </article>
  );
}

function renderSection(section: ResumeSectionKey, content: ResumeContent) {
  switch (section) {
    case "summary":
      return <p className="text-sm leading-6 text-neutral-700">{content.summary || "Write a focused professional summary."}</p>;
    case "experience":
      return (
        <div className="space-y-5">
          {content.experience.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-semibold">{item.title || "Role title"}</div>
                  <div className="text-sm text-neutral-600">{item.company || "Company"}</div>
                </div>
                <div className="text-sm text-neutral-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</div>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700">
                {item.bullets.filter(Boolean).map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "education":
      return (
        <div className="space-y-3">
          {content.education.map((item) => (
            <div key={item.id} className="text-sm leading-6">
              <div className="font-semibold">{item.degree || "Qualification"}</div>
              <div className="text-neutral-600">{[item.field, item.institution].filter(Boolean).join(", ")}</div>
              <div className="text-neutral-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</div>
            </div>
          ))}
        </div>
      );
    case "skills":
      return (
        <div className="flex flex-wrap gap-2">
          {content.skills.filter(Boolean).map((skill) => (
            <span key={skill} className="rounded-md bg-neutral-100 px-2.5 py-1 text-sm text-neutral-700">
              {skill}
            </span>
          ))}
        </div>
      );
    case "projects":
      return (
        <div className="space-y-3">
          {content.projects.map((item) => (
            <div key={item.id} className="text-sm leading-6">
              <div className="font-semibold">{item.name || "Project"}</div>
              <p className="text-neutral-700">{item.description}</p>
              <p className="text-neutral-500">{item.technologies.join(", ")}</p>
            </div>
          ))}
        </div>
      );
    case "certifications":
      return (
        <div className="space-y-2 text-sm">
          {content.certifications.map((item) => (
            <div key={item.id}>
              <span className="font-medium">{item.name || "Certification"}</span>
              <span className="text-neutral-600"> {item.issuer}</span>
            </div>
          ))}
        </div>
      );
    case "header":
      return null;
  }
}
