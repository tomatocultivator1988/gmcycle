type ApiErrorBody = {
  error?: string;
  details?: string[];
};

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(input, {
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
