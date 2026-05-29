import { describe, expect, it } from "vitest";

import { isSafeUrl } from "./url-safety";

describe("isSafeUrl", () => {
  it("accepts plain public https URLs", () => {
    expect(isSafeUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isSafeUrl("https://careers.example.com/posting/abc")).toBe(true);
    expect(isSafeUrl("http://example.com/job")).toBe(true);
  });

  it("rejects non-http protocols", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("ftp://example.com/file")).toBe(false);
    expect(isSafeUrl("gopher://example.com")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects garbage strings", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
    expect(isSafeUrl("/relative/path")).toBe(false);
  });

  it("rejects loopback hosts", () => {
    expect(isSafeUrl("http://localhost/")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1/")).toBe(false);
    expect(isSafeUrl("http://127.255.0.1/")).toBe(false);
    expect(isSafeUrl("http://0.0.0.0/")).toBe(false);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(isSafeUrl("http://10.0.0.1/")).toBe(false);
    expect(isSafeUrl("http://192.168.1.1/")).toBe(false);
    expect(isSafeUrl("http://172.16.0.1/")).toBe(false);
    expect(isSafeUrl("http://172.31.255.255/")).toBe(false);
  });

  it("rejects cloud metadata endpoints (169.254/16)", () => {
    expect(isSafeUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeUrl("https://169.254.0.1/")).toBe(false);
  });

  it("rejects mDNS / internal suffixes", () => {
    expect(isSafeUrl("http://printer.local/")).toBe(false);
    expect(isSafeUrl("http://api.internal/")).toBe(false);
  });

  it("does NOT reject a public IP that merely looks suspicious", () => {
    // 172.32 is outside the RFC1918 16-31 band, so it's public.
    expect(isSafeUrl("http://172.32.0.1/")).toBe(true);
    // 11.x is public. Caution: still uncommon, but not RFC1918.
    expect(isSafeUrl("http://11.0.0.1/")).toBe(true);
  });

  it("is case-insensitive on host", () => {
    expect(isSafeUrl("http://LOCALHOST/")).toBe(false);
    expect(isSafeUrl("http://Printer.LOCAL/")).toBe(false);
  });
});
