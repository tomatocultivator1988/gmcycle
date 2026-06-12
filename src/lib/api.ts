import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status },
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.issues.map((issue) => {
          const field = issue.path.join(".");

          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      },
      { status: 400 },
    );
  }

  console.error("Unhandled API error:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < maxRetries
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new ConflictError("Transaction conflict, please try again");
}
