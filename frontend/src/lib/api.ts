import type { FieldErrors, LoginResponse } from "../types/api";

const BASE = "/api/v1";
const ACCESS_KEY = "devflow.accessToken";
const REFRESH_KEY = "devflow.refreshToken";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, title: string, fieldErrors: FieldErrors = {}) {
    super(title);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  save(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshInFlight: Promise<boolean> | null = null;

async function requestRefresh(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      tokens.clear();
      return false;
    }

    const data = (await response.json()) as LoginResponse;
    tokens.save(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= requestRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function parseProblemDetails(response: Response): Promise<ApiError> {
  let title = `Request failed (${response.status})`;
  let fieldErrors: FieldErrors = {};

  try {
    const body = await response.json();
    if (typeof body.detail === "string") title = body.detail;
    if (body.errors && typeof body.errors === "object") {
      fieldErrors = body.errors as FieldErrors;
      const first = Object.values(fieldErrors)[0]?.[0];
      if (first && title.startsWith("Request failed")) title = first;
    }
  } catch {
    // non-JSON error body
  }

  return new ApiError(response.status, title, fieldErrors);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const send = async (): Promise<Response> =>
    fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(tokens.access
          ? { Authorization: `Bearer ${tokens.access}` }
          : {}),
        ...options.headers,
      },
    });

  let response = await send();

  if (response.status === 401 && tokens.refresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    }
  }

  if (!response.ok) {
    throw await parseProblemDetails(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
