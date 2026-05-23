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
  languages: "Languages",
  awards: "Awards",
  volunteering: "Volunteering",
  publications: "Publications",
  references: "References",
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

  const { font = "inter", accentColor = "#0f766e" } = content.settings || {};
  const fontMap: Record<string, string> = {
    inter: "Inter, sans-serif",
    roboto: "Roboto, sans-serif",
    merriweather: "Merriweather, serif",
    "noto-sinhala": "'Noto Sans Sinhala', Inter, sans-serif",
    "noto-tamil": "'Noto Sans Tamil', Inter, sans-serif",
  };

  return (
    <div className="relative overflow-hidden rounded-lg shadow-sm border bg-neutral-100 flex items-start justify-center p-4">
       <article 
         id="resume-print-area" 
         className={cn("bg-white text-neutral-950 w-full max-w-[21cm] min-h-[29.7cm] p-8 shadow-sm origin-top mx-auto", className)}
         style={{ 
           fontFamily: fontMap[font],
           '--accent': accentColor 
         } as React.CSSProperties}
       >
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
            <header key={section} className={cn("border-b pb-5 flex justify-between items-start gap-4", visual === "graphic" && "rounded-md p-5")} style={visual === "graphic" ? { backgroundColor: `${accentColor}15` } : {}}>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">{content.header.fullName || "Your Name"}</h2>
                <p className="mt-1 text-base font-medium" style={{ color: accentColor }}>{content.header.title || "Target role"}</p>
                <p className="mt-3 text-sm text-neutral-600">
                  {[content.header.email, content.header.phone, content.header.location, content.header.linkedin].filter(Boolean).join(" | ")}
                </p>
                {content.mode === "local" ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    {[content.header.street, content.header.district, content.header.postalCode].filter(Boolean).join(" | ")}
                    {content.header.expectedSalary ? ` | Expected ${content.header.expectedSalary} ${content.header.salaryPeriod}` : ""}
                    {content.header.nic ? ` | NIC ${maskNic(content.header.nic, content.settings?.publicAccess !== "private")}` : ""}
                  </p>
                ) : null}
              </div>
              {content.settings?.includePhoto && content.header.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={content.header.photoUrl} alt="" className="size-20 rounded-md object-cover" />
              ) : null}
              {qrCodeUrl && (
                <div className="flex flex-col items-center gap-1 shrink-0 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="Talent Profile QR Code" className="size-16 rounded border bg-white p-0.5 shadow-sm" />
                  <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Scan Profile</span>
                </div>
              )}
            </header>
          );
        }

        return (
          <section key={section} className={cn("mt-6", section === "references" && content.settings?.hideReferences && "hidden")}>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: accentColor }}>{sectionTitles[section]}</h3>
            <div className="mt-3">{renderSection(section, content)}</div>
          </section>
        );
      })}
    </article>
   </div>
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
      return content.settings?.showSkillRatings && content.skillRatings.length ? (
        <div className="grid gap-2">
          {content.skillRatings.filter((item) => item.name).map((skill) => (
            <div key={skill.id} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 text-sm">
              <span className="font-medium text-neutral-700">{skill.name}</span>
              <div className="h-1.5 rounded-full bg-neutral-100">
                <div className="h-full rounded-full" style={{ width: `${skill.rating * 20}%`, backgroundColor: content.settings?.accentColor || "#0f766e" }} />
              </div>
              <span className="text-xs text-neutral-500">{skill.rating}/5</span>
            </div>
          ))}
        </div>
      ) : (
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
    case "languages":
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {content.languages?.map((item) => (
            <div key={item.id} className="flex gap-1.5 items-baseline">
              <span className="font-medium text-neutral-800">{item.name || "Language"}</span>
              <span className="text-neutral-500 text-xs text-muted-foreground">{item.proficiency}</span>
            </div>
          ))}
        </div>
      );
    case "awards":
      return (
        <div className="space-y-3">
          {content.awards?.map((item) => (
            <div key={item.id} className="text-sm leading-6">
              <div className="font-semibold">{item.name || "Award Name"}</div>
              <div className="text-neutral-600">{[item.issuer, item.date].filter(Boolean).join(", ")}</div>
            </div>
          ))}
        </div>
      );
    case "volunteering":
      return (
        <div className="space-y-4">
          {content.volunteering?.map((item) => (
            <div key={item.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-semibold">{item.role || "Role"}</div>
                  <div className="text-sm text-neutral-600">{item.organization || "Organization"}</div>
                </div>
                <div className="text-sm text-neutral-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</div>
              </div>
            </div>
          ))}
        </div>
      );
    case "publications":
      return (
        <div className="space-y-3">
          {content.publications?.map((item) => (
            <div key={item.id} className="text-sm leading-6">
              <div className="font-semibold">{item.title || "Publication"}</div>
              <div className="text-neutral-600">{[item.publisher, item.date].filter(Boolean).join(", ")}</div>
              {item.url ? <div className="text-neutral-500">{item.url}</div> : null}
            </div>
          ))}
        </div>
      );
    case "references":
      if (content.settings?.hideReferences) return null;
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {content.references?.map((item) => (
            <div key={item.id} className="text-sm leading-6">
              <div className="font-semibold">{item.name || "Referee"}</div>
              <div className="text-neutral-600">{[item.title, item.organization].filter(Boolean).join(", ")}</div>
              <div className="text-neutral-500">{[item.phone, item.email].filter(Boolean).join(" | ")}</div>
            </div>
          ))}
        </div>
      );
    case "header":
      return null;
  }
}

function maskNic(nic: string, shouldMask: boolean) {
  if (!shouldMask) return nic;
  return nic.replace(/.(?=.{4})/g, "*");
}
