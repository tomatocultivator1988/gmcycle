import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function hasBlobToken(): boolean {
  return typeof process.env.BLOB_READ_WRITE_TOKEN === "string" && process.env.BLOB_READ_WRITE_TOKEN.length > 0;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `payment-${randomUUID()}.${ext}`;

    let url: string;

    if (hasBlobToken()) {
      // ── Vercel Blob (production) ──
      const blob = await put(`payments/${filename}`, file, {
        access: "public",
        addRandomSuffix: false,
      });
      url = blob.url;
    } else if (process.env.VERCEL) {
      // ── Vercel without Blob token ──
      return NextResponse.json(
        { error: "File upload requires BLOB_READ_WRITE_TOKEN on Vercel. Add it in Environment Variables." },
        { status: 501 },
      );
    } else {
      // ── Local filesystem (development) ──
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filepath = join(process.cwd(), "public", "uploads", "payments", filename);
      await writeFile(filepath, buffer);
      url = `/uploads/payments/${filename}`;
    }

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
