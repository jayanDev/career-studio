import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import {
  getGcvFonts,
  getGcvPalette,
  knownLogoLabel,
  type GcvBlock,
  type GcvTheme,
} from "@/lib/gcv-design";
import type { ResumeContent, ResumeSectionKey } from "@/lib/resume-content";
import { cn } from "@/lib/utils";

const sectionTitles: Partial<Record<GcvBlock["type"], string>> = {
  summary: "Profile",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  "skill-bars": "Capabilities",
  "language-bars": "Languages",
  projects: "Portfolio Projects",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
  volunteering: "Volunteering",
  references: "Referees",
  portfolio: "Selected Work",
  timeline: "Career Timeline",
};

export function GcvVisualPreview({
  content,
  theme,
  talentSlug,
  locale = "en",
  className,
  publicView = false,
}: {
  content: ResumeContent;
  theme: GcvTheme;
  talentSlug?: string;
  locale?: string;
  className?: string;
  publicView?: boolean;
}) {
  const palette = getGcvPalette(theme);
  const fonts = getGcvFonts(theme);
  const enabledBlocks = theme.blocks.filter((block) => block.enabled);
  const headerBlocks = enabledBlocks.filter((block) => block.region === "header" || block.type === "header");
  const sidebarBlocks = enabledBlocks.filter((block) => block.region === "sidebar" && block.type !== "header");
  const mainBlocks = enabledBlocks.filter((block) => block.region === "main" && block.type !== "header");
  const footerBlocks = enabledBlocks.filter((block) => block.region === "footer");
  const sidebarFirst = theme.layout === "sidebar-left";
  const oneColumn = theme.mode === "ats-safe" || theme.layout === "one-column";
  const qrUrl = theme.showQr && talentSlug ? `/${locale}/talent/${talentSlug}` : "";

  return (
    <div className={cn("relative overflow-auto rounded-lg border bg-neutral-100 p-4", className)}>
      <style dangerouslySetInnerHTML={{ __html: printStyles(theme.paper) }} />
      <article
        id="gcv-print-area"
        className={cn(
          "mx-auto min-h-[29.7cm] w-full max-w-[21cm] overflow-hidden bg-white text-neutral-950 shadow-sm",
          theme.density === "compact" ? "p-6" : theme.density === "spacious" ? "p-10" : "p-8",
          theme.animated && publicView && "motion-safe:animate-in motion-safe:fade-in-0"
        )}
        style={{
          fontFamily: fonts.body,
          color: palette.text,
          borderTop: theme.showBleed ? `8px solid ${palette.accent}` : undefined,
        }}
      >
        {theme.showMotif ? <Motif accent={palette.accent} /> : null}
        <header
          className={cn("relative grid gap-5 border-b pb-6", theme.layout === "canvas" ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto]")}
          style={{ borderColor: palette.muted }}
        >
          {headerBlocks.map((block) => block.type === "header" ? (
            <HeaderBlock key={block.id} content={content} theme={theme} qrUrl={qrUrl} />
          ) : null)}
        </header>

        <div className={cn("mt-6 grid gap-6", oneColumn ? "grid-cols-1" : "grid-cols-[0.34fr_1fr]")}>
          {!oneColumn && sidebarFirst ? <Column blocks={sidebarBlocks} content={content} theme={theme} side="sidebar" /> : null}
          <Column blocks={mainBlocks} content={content} theme={theme} side="main" />
          {!oneColumn && !sidebarFirst ? <Column blocks={sidebarBlocks} content={content} theme={theme} side="sidebar" /> : null}
        </div>

        {footerBlocks.length ? (
          <footer className="mt-6 border-t pt-4" style={{ borderColor: palette.muted }}>
            <Column blocks={footerBlocks} content={content} theme={theme} side="footer" />
          </footer>
        ) : null}
      </article>
    </div>
  );
}

function HeaderBlock({ content, theme, qrUrl }: { content: ResumeContent; theme: GcvTheme; qrUrl: string }) {
  const palette = getGcvPalette(theme);
  const fonts = getGcvFonts(theme);
  const photoClass = cn(
    "size-24 object-cover",
    theme.photoShape === "circle" && "rounded-full",
    theme.photoShape === "rounded" && "rounded-lg",
    theme.photoShape === "square" && "rounded-none",
    theme.photoShape === "hexagon" && "[clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]",
    theme.photoFilter === "bw" && "grayscale",
    theme.photoFilter === "sepia" && "sepia",
    theme.photoFilter === "bright" && "brightness-110 contrast-105"
  );

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: palette.accent }}>
          {theme.mode === "ats-safe" ? "ATS-safe graphical CV" : "Graphical CV"}
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight" style={{ fontFamily: fonts.heading }}>
          {content.header.fullName || "Your Name"}
        </h2>
        <p className="mt-1 text-lg font-medium" style={{ color: palette.accent }}>
          {content.header.title || "Target Role"}
        </p>
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          {[content.header.email, content.header.phone, content.header.location, content.header.linkedin].filter(Boolean).join(" | ")}
        </p>
        {content.mode === "local" ? (
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {[content.header.street, content.header.district, content.header.postalCode].filter(Boolean).join(" | ")}
            {content.header.expectedSalary ? ` | Expected ${content.header.expectedSalary} ${content.header.salaryPeriod}` : ""}
            {content.header.nic && theme.mode !== "visual" ? ` | NIC ${maskNic(content.header.nic)}` : ""}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-3">
        {theme.mode !== "ats-safe" && theme.showPhoto && content.header.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.header.photoUrl} alt="" className={photoClass} />
        ) : (
          <div className={cn(photoClass, "grid place-items-center text-2xl font-semibold text-white")} style={{ backgroundColor: palette.accent }}>
            {(content.header.fullName || "YN").split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}
          </div>
        )}
        {qrUrl ? <div className="rounded-md border px-2 py-1 text-[10px] text-neutral-500">QR: {qrUrl}</div> : null}
      </div>
    </>
  );
}

function Column({ blocks, content, theme, side }: { blocks: GcvBlock[]; content: ResumeContent; theme: GcvTheme; side: "main" | "sidebar" | "footer" }) {
  return (
    <div className={cn("space-y-5", side === "sidebar" && "text-sm")}>
      {blocks.map((block) => (
        <section key={block.id} className={cn(block.pageBreakBefore && "break-before-page")}>
          {renderBlock(block, content, theme)}
        </section>
      ))}
    </div>
  );
}

function renderBlock(block: GcvBlock, content: ResumeContent, theme: GcvTheme) {
  if (block.type === "photo") return null;
  if (block.type === "divider") return <hr className="border-neutral-200" />;
  if (block.type === "portfolio") return <PortfolioBlock theme={theme} />;
  if (block.type === "skill-bars") return <SkillBars content={content} theme={theme} />;
  if (block.type === "language-bars") return <LanguageBars content={content} theme={theme} />;
  if (block.type === "timeline") return <TimelineBlock content={content} theme={theme} />;

  return (
    <BlockFrame title={sectionTitles[block.type] || block.label} theme={theme}>
      {renderResumeSection(block.type as ResumeSectionKey, content, theme)}
    </BlockFrame>
  );
}

function BlockFrame({ title, theme, children }: { title: string; theme: GcvTheme; children: ReactNode }) {
  const palette = getGcvPalette(theme);
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.accent }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.accent }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function renderResumeSection(section: ResumeSectionKey, content: ResumeContent, theme: GcvTheme) {
  switch (section) {
    case "summary":
      return <p className="text-sm leading-6 text-neutral-700">{content.summary || "Add a focused visual profile summary."}</p>;
    case "experience":
      return (
        <div className="space-y-4">
          {content.experience.map((item) => (
            <div key={item.id} className="relative rounded-md border border-neutral-100 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {theme.showLogos && item.company ? <LogoBadge name={item.company} /> : null}
                    {item.title || "Role title"}
                  </div>
                  <div className="text-sm text-neutral-600">{item.company || "Company"}</div>
                </div>
                <div className="text-xs text-neutral-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</div>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700">
                {item.bullets.filter(Boolean).slice(0, 4).map((bullet) => <li key={bullet}>{bullet}</li>)}
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
              <div className="flex items-center gap-2 font-semibold">
                {theme.showLogos && item.institution ? <LogoBadge name={item.institution} /> : null}
                {item.degree || "Qualification"}
              </div>
              <div className="text-neutral-600">{[item.field, item.institution].filter(Boolean).join(", ")}</div>
              <div className="text-neutral-500">{[item.startDate, item.endDate].filter(Boolean).join(" - ")}</div>
            </div>
          ))}
        </div>
      );
    case "skills":
      return (
        <div className="flex flex-wrap gap-2">
          {content.skills.filter(Boolean).map((skill) => <Badge key={skill} variant="outline" className="rounded-md">{skill}</Badge>)}
        </div>
      );
    case "projects":
      return (
        <div className="grid gap-3">
          {content.projects.map((item) => (
            <div key={item.id} className="rounded-md p-3" style={{ backgroundColor: `${getGcvPalette(theme).muted}80` }}>
              <div className="font-semibold">{item.name || "Project"}</div>
              <p className="mt-1 text-sm leading-6 text-neutral-700">{item.description}</p>
              <p className="mt-1 text-xs text-neutral-500">{item.technologies.join(", ")}</p>
            </div>
          ))}
        </div>
      );
    case "certifications":
      return <List items={content.certifications.map((item) => [item.name, item.issuer, item.date].filter(Boolean).join(" - "))} />;
    case "languages":
      return <List items={content.languages.map((item) => [item.name, item.proficiency].filter(Boolean).join(" - "))} />;
    case "awards":
      return <List items={content.awards.map((item) => [item.name, item.issuer, item.date].filter(Boolean).join(" - "))} />;
    case "volunteering":
      return <List items={content.volunteering.map((item) => [item.role, item.organization].filter(Boolean).join(" - "))} />;
    case "publications":
      return <List items={content.publications.map((item) => [item.title, item.publisher, item.date].filter(Boolean).join(" - "))} />;
    case "references":
      return <List items={content.references.map((item) => [item.name, item.title, item.organization, item.phone, item.email].filter(Boolean).join(" - "))} />;
    default:
      return null;
  }
}

function SkillBars({ content, theme }: { content: ResumeContent; theme: GcvTheme }) {
  const palette = getGcvPalette(theme);
  const skills = content.skillRatings.length
    ? content.skillRatings
    : content.skills.slice(0, 8).map((skill, index) => ({ id: skill, name: skill, rating: Math.max(3, 5 - (index % 3)), category: "Core" }));
  return (
    <BlockFrame title="Skill Bars" theme={theme}>
      <div className="grid gap-2">
        {skills.filter((skill) => skill.name).slice(0, 10).map((skill) => (
          <div key={skill.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-neutral-700">{skill.name}</span>
            <span className="text-xs text-neutral-500">{skill.rating}/5</span>
            <div className="col-span-2 h-2 rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${skill.rating * 20}%`, backgroundColor: palette.accent }} />
            </div>
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

function LanguageBars({ content, theme }: { content: ResumeContent; theme: GcvTheme }) {
  const levels: Record<string, number> = { native: 100, fluent: 88, advanced: 78, intermediate: 58, basic: 35, a1: 20, a2: 35, b1: 50, b2: 68, c1: 84, c2: 96 };
  const palette = getGcvPalette(theme);
  return (
    <BlockFrame title="Language Bars" theme={theme}>
      <div className="grid gap-2">
        {content.languages.map((language) => {
          const percent = levels[language.proficiency.toLowerCase()] ?? 65;
          return (
            <div key={language.id} className="text-sm">
              <div className="flex justify-between"><span>{language.name}</span><span className="text-xs text-neutral-500">{language.proficiency}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: palette.accent }} /></div>
            </div>
          );
        })}
      </div>
    </BlockFrame>
  );
}

function TimelineBlock({ content, theme }: { content: ResumeContent; theme: GcvTheme }) {
  const palette = getGcvPalette(theme);
  const items = [...content.experience.map((item) => ({ id: item.id, title: item.title || item.company, date: [item.startDate, item.endDate].filter(Boolean).join(" - ") })), ...content.education.map((item) => ({ id: item.id, title: item.degree || item.institution, date: [item.startDate, item.endDate].filter(Boolean).join(" - ") }))];
  return (
    <BlockFrame title="Timeline" theme={theme}>
      <div className="space-y-3 border-l pl-4" style={{ borderColor: palette.accent }}>
        {items.slice(0, 8).map((item) => (
          <div key={item.id} className="relative text-sm">
            <span className="absolute -left-[21px] top-1 size-2 rounded-full" style={{ backgroundColor: palette.accent }} />
            <div className="font-medium">{item.title || "Milestone"}</div>
            <div className="text-xs text-neutral-500">{item.date}</div>
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

function PortfolioBlock({ theme }: { theme: GcvTheme }) {
  return (
    <BlockFrame title="Portfolio Embeds" theme={theme}>
      <div className="grid gap-2">
        {theme.portfolioEmbeds.length ? theme.portfolioEmbeds.map((url) => (
          <a key={url} href={url} className="rounded-md border p-3 text-sm text-neutral-700 hover:bg-neutral-50">
            {url}
          </a>
        )) : <p className="text-sm text-neutral-500">Add YouTube, Behance, Dribbble, GitHub, CodePen, or portfolio links.</p>}
      </div>
    </BlockFrame>
  );
}

function LogoBadge({ name }: { name: string }) {
  const label = knownLogoLabel(name);
  if (!label) return null;
  return <span className="grid size-7 place-items-center rounded bg-neutral-900 text-[10px] font-bold text-white">{label}</span>;
}

function Motif({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute right-6 top-6 grid grid-cols-4 gap-1 opacity-10">
      {Array.from({ length: 16 }).map((_, index) => (
        <span key={index} className="size-2 rotate-45 rounded-sm" style={{ backgroundColor: accent }} />
      ))}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-neutral-700">
      {items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function maskNic(nic: string) {
  return nic.replace(/.(?=.{4})/g, "*");
}

function printStyles(paper: "A4" | "Letter") {
  return `
    @media print {
      header, footer, nav, aside, form, button, .no-print, [role="button"] { display: none !important; }
      @page { size: ${paper} portrait; margin: 12mm; }
      body * { visibility: hidden; }
      #gcv-print-area, #gcv-print-area * { visibility: visible; }
      #gcv-print-area { position: absolute; left: 0; top: 0; width: 100% !important; box-shadow: none !important; }
    }
  `;
}
