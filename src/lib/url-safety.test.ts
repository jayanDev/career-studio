import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FetchCapExceeded,
  FetchContentTypeRejected,
  FetchTimeout,
  fetchTextWithCap,
  isSafeUrl,
} from "./url-safety";

/** Build a Response whose body streams `chunks` of UTF-8 text. */
function streamingResponse(
  chunks: string[],
  headers: Record<string, string> = {},
  status = 200,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status, headers });
}

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

describe("fetchTextWithCap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the body for a normal small response", async () => {
    vi.stubGlobal("fetch", async () =>
      streamingResponse(["<html>", "job posting", "</html>"], {
        "content-type": "text/html; charset=utf-8",
      }),
    );
    const res = await fetchTextWithCap("https://example.com/job");
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.text).toBe("<html>job posting</html>");
  });

  it("rejects when advertised content-length exceeds the cap", async () => {
    vi.stubGlobal("fetch", async () =>
      streamingResponse(["x"], {
        "content-type": "text/html",
        "content-length": String(5 * 1024 * 1024),
      }),
    );
    await expect(fetchTextWithCap("https://example.com", { maxBytes: 1024 })).rejects.toBeInstanceOf(
      FetchCapExceeded,
    );
  });

  it("aborts mid-stream once the decoded body passes the cap", async () => {
    // No content-length header, so the only defence is the streaming cap.
    const big = "a".repeat(2000);
    vi.stubGlobal("fetch", async () =>
      streamingResponse([big, big, big], { "content-type": "text/html" }),
    );
    await expect(fetchTextWithCap("https://example.com", { maxBytes: 1024 })).rejects.toBeInstanceOf(
      FetchCapExceeded,
    );
  });

  it("rejects unsupported content-types before reading the body", async () => {
    vi.stubGlobal("fetch", async () =>
      streamingResponse(["PNGDATA"], { "content-type": "image/png" }),
    );
    await expect(fetchTextWithCap("https://example.com/x.png")).rejects.toBeInstanceOf(
      FetchContentTypeRejected,
    );
  });

  it("tolerates a missing content-type", async () => {
    vi.stubGlobal("fetch", async () => streamingResponse(["plain body"], {}));
    const res = await fetchTextWithCap("https://example.com");
    expect(res.text).toBe("plain body");
  });

  it("throws FetchTimeout when the request is aborted by the timeout", async () => {
    // Simulate a slow origin: resolve only when the signal aborts.
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }
      });
    });
    await expect(fetchTextWithCap("https://slow.example.com", { timeoutMs: 20 })).rejects.toBeInstanceOf(
      FetchTimeout,
    );
  });
});
