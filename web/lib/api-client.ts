/**
 * SAIREX Centralized API Client
 *
 * Single source of truth for all client-side API requests.
 * Every page must use this instead of raw fetch().
 *
 * Features:
 *  - Typed responses with discriminated union (ok / error)
 *  - Auto JSON serialization
 *  - Consistent error handling
 *  - Base path handling (all routes relative to /api)
 */

/* ── Response types ────────────────────────────────────────── */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  status: number;
}

export interface ApiError {
  ok: false;
  status: number;
  error: string;
  /** Field-level validation errors from Zod */
  fieldErrors?: Record<string, string[]>;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

/* ── Core request function ─────────────────────────────────── */

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  try {
    const isFormData = options.body instanceof FormData;
    const defaultHeaders: HeadersInit = isFormData
      ? {}
      : { "Content-Type": "application/json" };

    const res = await fetch(url, {
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      ...options,
    });

    // Handle empty responses (204 No Content)
    if (res.status === 204) {
      return { ok: true, data: null as T, status: 204 };
    }

    const body = await res.json().catch(() => null);

    if (res.ok) {
      return { ok: true, data: body as T, status: res.status };
    }

    // Error response — normalize shape
    return {
      ok: false,
      status: res.status,
      error:
        body?.error ||
        body?.message ||
        `Request failed (${res.status})`,
      fieldErrors: body?.errors,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err instanceof Error
          ? err.message
          : "Network error — check your connection",
    };
  }
}

/* ── Public API ────────────────────────────────────────────── */

export const api = {
  get<T>(endpoint: string) {
    return request<T>(endpoint);
  },

  post<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: "DELETE",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  /** Upload FormData (multipart). Browser sets Content-Type boundary automatically. */
  upload<T>(endpoint: string, formData: FormData) {
    return request<T>(endpoint, {
      method: "POST",
      headers: {},
      body: formData,
    });
  },
} as const;
