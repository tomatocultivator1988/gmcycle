import { z } from "zod";

export type FieldErrors = Record<string, string>;

export function validateForm<T extends z.ZodTypeAny>(
  schema: T,
  data: Record<string, unknown>,
): { success: true; data: z.infer<T> } | { success: false; errors: FieldErrors } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: FieldErrors = {};

  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return { success: false, errors };
}

export function clearFieldError(
  setErrors: (updater: (prev: FieldErrors) => FieldErrors) => void,
  field: string,
) {
  setErrors((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
}
