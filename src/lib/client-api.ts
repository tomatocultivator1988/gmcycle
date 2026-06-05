type ApiErrorBody = {
  error?: string;
  details?: string[];
};

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = (await response.json()) as ApiErrorBody | T;

  if (!response.ok) {
    const error = data as ApiErrorBody;
    throw new Error(error.details?.join(" ") || error.error || "Request failed");
  }

  return data as T;
}
