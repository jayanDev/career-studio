/**
 * Shared PII masking helpers for public share pages.
 *
 * Public ATS / Career GPS / etc. reports must NEVER expose the
 * candidate's name, email, phone, exact street address, LinkedIn URL,
 * GitHub URL, or Sri Lankan NIC. Helpers here strip those values
 * deterministically so the same masking logic is reused everywhere a
 * public share view renders user content.
 *
 * Rule of thumb: keep the analysis, drop the identity.
 */

const REDACTED = "[redacted]";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /(https?:\/\/[^\s,)]+|(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|co|lk|me|dev|in)(?:\/[^\s,)]*)?)/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
// Sri Lankan NIC: 9 digits + V/X OR 12 digits starting 19/20.
const NIC_RE = /\b\d{9}[VvXx]\b|\b(?:19|20)\d{10}\b/g;

/**
 * Strip every common PII pattern from a free-text string. Run this over
 * any narrative field that might contain an email / phone / URL / NIC
 * (identity statements, pathway summaries, suggestions, etc.).
 */
export function maskText(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, REDACTED)
    .replace(NIC_RE, REDACTED)
    .replace(PHONE_RE, REDACTED)
    .replace(URL_RE, REDACTED);
}

/**
 * Mask every string inside an arbitrary list of items.
 */
export function maskList<T extends string>(items: T[] | undefined | null): string[] {
  if (!items) return [];
  return items.map(maskText);
}

/**
 * Mask a candidate name to its first initial. Use for the public share
 * page header so the candidate isn't directly identifiable.
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return "Anonymous candidate";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Anonymous candidate";
  const initial = trimmed.charAt(0).toUpperCase();
  return `Candidate (${initial}.)`;
}

/**
 * Reduce a location string to country-level if it has a "City, Country"
 * form, or hide it entirely otherwise.
 */
export function maskLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}

export const REDACTION_PLACEHOLDER = REDACTED;
