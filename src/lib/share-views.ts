import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type ShareViewType = "resume" | "cover-letter" | "gcv" | "linkedin" | "career-gps";

export type ShareViewRecord = {
  id: string;
  type: ShareViewType;
  itemId: string;
  ownerId?: string;
  viewedAt: string;
  visitorHash: string;
  referrer: string;
  userAgent: string;
};

const viewLogPath = path.join(process.cwd(), ".next", "share-views.jsonl");
type HeaderReader = Pick<Headers, "get">;

function headerValue(headers: HeaderReader, key: string) {
  return headers.get(key) || "";
}

function visitorHashFromHeaders(headers: HeaderReader) {
  const forwardedFor = headerValue(headers, "x-forwarded-for").split(",")[0]?.trim();
  const ip = forwardedFor || headerValue(headers, "x-real-ip") || "unknown";
  const userAgent = headerValue(headers, "user-agent") || "unknown";
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
}

export async function recordShareView(input: {
  type: ShareViewType;
  itemId: string;
  ownerId?: string;
  headers: HeaderReader;
}) {
  const record: ShareViewRecord = {
    id: randomUUID(),
    type: input.type,
    itemId: input.itemId,
    ownerId: input.ownerId,
    viewedAt: new Date().toISOString(),
    visitorHash: visitorHashFromHeaders(input.headers),
    referrer: headerValue(input.headers, "referer") || "direct",
    userAgent: headerValue(input.headers, "user-agent").slice(0, 180),
  };

  try {
    await fs.mkdir(path.dirname(viewLogPath), { recursive: true });
    await fs.appendFile(viewLogPath, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    // View analytics should never break a public share page.
  }
}

export async function readShareViews(filters: {
  ownerId: string;
  type?: ShareViewType | null;
  itemId?: string | null;
}) {
  let raw = "";
  try {
    raw = await fs.readFile(viewLogPath, "utf8");
  } catch {
    return [];
  }

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as ShareViewRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is ShareViewRecord => {
      if (!record || record.ownerId !== filters.ownerId) return false;
      if (filters.type && record.type !== filters.type) return false;
      if (filters.itemId && record.itemId !== filters.itemId) return false;
      return true;
    });
}
