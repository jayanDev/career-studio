/**
 * Contact-info validation.
 *
 * Validates each field the parser extracted from the resume header:
 *   - email     : RFC-ish format + "unprofessional" handle detection
 *                 (cool_dude_98@hotmail.com, kitten_lover@... etc.)
 *   - phone     : digits + country code; flags missing +country prefix.
 *                 Also recognises Sri Lankan formats (+94 / 0xx).
 *   - linkedin  : well-formed linkedin.com/in/<slug> URL.
 *   - location  : looks like "City, Country" rather than just a country.
 *   - name      : title-cased and not absurd length.
 *
 * Issues are surfaced into the global issues list. We also return a
 * per-field findings object so the UI can render inline tick / cross icons.
 */

import type { ParsedResume } from "@/lib/ats/parse-sections";

export type ContactFieldStatus = "valid" | "warning" | "invalid" | "missing";

export type ContactFinding = {
  field: keyof ParsedResume["contact"] | "name";
  value: string | null;
  status: ContactFieldStatus;
  message?: string;
};

export type ContactReport = {
  findings: ContactFinding[];
  issues: string[];
  score: number; // 0-100 indicating contact-block health
};

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const UNPROFESSIONAL_HANDLE = /^(cool|hot|sexy|baby|cute|kitten|puppy|princess|boss|king|queen|ninja|guru|rockstar|legend|gamer|crazy|hunter|killer|destroyer|partyboy|partygirl|playboy|playgirl|sweet|naughty|bad|wild|love|lover|crush)[\W_\d]/i;
const DIGIT_RUN_HANDLE = /(\d{4,}|\d{2}_?\d{2}_?\d{2})/;

const LINKEDIN_RE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]{3,100}\/?$/i;
const GITHUB_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]{1,39}\/?$/i;

const LK_PHONE = /^\+?94[\s-]?(7\d|11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)\d{7}$/;
const LK_LOCAL_PHONE = /^0(7\d|11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)\d{7}$/;
const INTL_PHONE = /^\+\d{6,15}$/;

function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

/**
 * Public utility: normalise any Sri Lankan phone format to +94xxxxxxxxx.
 * Returns null if the input doesn't look like an LK number.
 */
export function normaliseLkPhone(raw: string): string | null {
  const digits = normalisePhone(raw);
  if (LK_PHONE.test(digits)) {
    return digits.startsWith("+") ? digits : `+${digits}`;
  }
  if (LK_LOCAL_PHONE.test(digits)) {
    return `+94${digits.slice(1)}`;
  }
  return null;
}

export function validateContact(parsed: ParsedResume): ContactReport {
  const c = parsed.contact;
  const findings: ContactFinding[] = [];
  const issues: string[] = [];

  // Name
  if (!c.name) {
    findings.push({ field: "name", value: null, status: "missing", message: "Name not detected" });
    issues.push("Name not detected in the resume header");
  } else if (c.name.length > 50) {
    findings.push({
      field: "name",
      value: c.name,
      status: "warning",
      message: "Header line is unusually long — make sure your name is on its own line",
    });
  } else if (c.name === c.name.toUpperCase() && c.name.length > 3) {
    findings.push({
      field: "name",
      value: c.name,
      status: "warning",
      message: "Name is in ALL CAPS — title case parses more reliably",
    });
  } else {
    findings.push({ field: "name", value: c.name, status: "valid" });
  }

  // Email
  if (!c.email) {
    findings.push({ field: "email", value: null, status: "missing" });
    issues.push("No email address detected");
  } else if (!EMAIL_RE.test(c.email)) {
    findings.push({
      field: "email",
      value: c.email,
      status: "invalid",
      message: "Email does not match a valid pattern",
    });
    issues.push("Email format looks invalid");
  } else {
    const handle = c.email.split("@")[0];
    if (UNPROFESSIONAL_HANDLE.test(handle) || DIGIT_RUN_HANDLE.test(handle)) {
      findings.push({
        field: "email",
        value: c.email,
        status: "warning",
        message: "Use a professional handle, ideally firstname.lastname@",
      });
      issues.push("Email handle looks unprofessional — use firstname.lastname format");
    } else {
      findings.push({ field: "email", value: c.email, status: "valid" });
    }
  }

  // Phone
  if (!c.phone) {
    findings.push({ field: "phone", value: null, status: "missing" });
    issues.push("No phone number detected");
  } else {
    const digits = normalisePhone(c.phone);
    if (LK_PHONE.test(digits)) {
      findings.push({ field: "phone", value: c.phone, status: "valid", message: "Sri Lanka format" });
    } else if (LK_LOCAL_PHONE.test(digits)) {
      findings.push({
        field: "phone",
        value: c.phone,
        status: "warning",
        message: "Add +94 country code for international applications",
      });
      issues.push("Add +94 country code to your phone number for international applications");
    } else if (INTL_PHONE.test(digits)) {
      findings.push({ field: "phone", value: c.phone, status: "valid", message: "International format" });
    } else if (digits.length < 7) {
      findings.push({
        field: "phone",
        value: c.phone,
        status: "invalid",
        message: "Phone number too short to be valid",
      });
      issues.push("Phone number appears too short to be valid");
    } else {
      findings.push({
        field: "phone",
        value: c.phone,
        status: "warning",
        message: "Add a country code (+xx)",
      });
      issues.push("Add a country code (+xx) to your phone number");
    }
  }

  // Location
  if (!c.location) {
    findings.push({ field: "location", value: null, status: "missing" });
    issues.push("No location detected — add 'City, Country'");
  } else if (!/,/.test(c.location)) {
    findings.push({
      field: "location",
      value: c.location,
      status: "warning",
      message: "Format as 'City, Country' for ATS parsers",
    });
  } else {
    findings.push({ field: "location", value: c.location, status: "valid" });
  }

  // LinkedIn
  if (!c.linkedin) {
    findings.push({ field: "linkedin", value: null, status: "missing" });
    issues.push("No LinkedIn URL detected");
  } else if (!LINKEDIN_RE.test(c.linkedin)) {
    findings.push({
      field: "linkedin",
      value: c.linkedin,
      status: "invalid",
      message: "Use the full linkedin.com/in/yourname URL",
    });
    issues.push("LinkedIn URL is malformed");
  } else {
    findings.push({ field: "linkedin", value: c.linkedin, status: "valid" });
  }

  // GitHub (optional, only flagged if malformed)
  if (c.github) {
    if (!GITHUB_RE.test(c.github)) {
      findings.push({
        field: "github",
        value: c.github,
        status: "invalid",
        message: "Use full github.com/username URL",
      });
    } else {
      findings.push({ field: "github", value: c.github, status: "valid" });
    }
  }

  // Compute a 0-100 contact-block health score.
  const validCount = findings.filter((f) => f.status === "valid").length;
  const warningCount = findings.filter((f) => f.status === "warning").length;
  const total = findings.length || 1;
  const score = Math.round(((validCount + warningCount * 0.5) / total) * 100);

  return { findings, issues, score };
}
