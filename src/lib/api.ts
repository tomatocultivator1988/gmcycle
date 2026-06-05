import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotFoundError, ValidationError } from "@/lib/errors";

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

  console.error(error);

  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
