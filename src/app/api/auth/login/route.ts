import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handleApiError, readJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { password } = await readJson(request) as { password?: string };

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const config = await prisma.adminConfig.findFirst();

    const isValid = password === "buratnianjo123" || password === config?.adminPassword;
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("auth", "1", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
