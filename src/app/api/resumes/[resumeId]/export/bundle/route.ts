import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getResumePlainTextForExport } from "@/server/services/resumes/export-service";

export const runtime = "nodejs";

type ZipFile = {
  name: string;
  content: Uint8Array;
};

export async function GET(_request: Request, context: { params: Promise<{ resumeId: string }> }) {
  const session = await auth();
  const { resumeId } = await context.params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resume = await getResumePlainTextForExport(session.user.id, resumeId);
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const files: ZipFile[] = [
    { name: "resume.txt", content: encoder.encode(resume.text) },
    { name: "resume.json", content: encoder.encode(JSON.stringify(resume.content, null, 2)) },
    {
      name: "export-links.txt",
      content: encoder.encode(
        [
          "Career Studio export bundle",
          "",
          "Download the designed files from these authenticated endpoints:",
          `/api/resumes/${resumeId}/export/pdf`,
          `/api/resumes/${resumeId}/export/docx`,
        ].join("\n")
      ),
    },
  ];

  const zip = createStoredZip(files);
  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${resume.title.replace(/[^a-z0-9-]+/gi, "_")}_bundle.zip"`,
    },
  });
}

function createStoredZip(files: ZipFile[]) {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.content);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.content.length),
      u32(file.content.length),
      u16(name.length),
      u16(0),
      name,
      file.content,
    ]);
    chunks.push(local);
    centralDirectory.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.content.length),
        u32(file.content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ])
    );
    offset += local.length;
  }

  const directory = concat(centralDirectory);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(directory.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...chunks, directory, end]);
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
