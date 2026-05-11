// Local-password auth helpers for the Mike frontend.
//
// Wave 2 replaced Supabase with a local single-user backend that hands out
// an opaque session token. We persist that token in localStorage so every
// API call (whether it goes through MikeClient, mikeApi.ts, or a one-off
// fetch in a hook) can attach it as a bearer token.
//
// The shape mirrors what the backend exposes:
//   GET  /auth/status -> { initialized, authenticated }
//   POST /auth/setup  body { password } -> { token }
//   POST /auth/login  body { password } -> { token }
//   POST /auth/logout
//
// On any 401 the consumer should call clearMikeToken() and route the user
// back to /login.

const TOKEN_KEY = "mike.token";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function getMikeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setMikeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage disabled — the request will 401 next round */
  }
}

export function clearMikeToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function authHeader(): Record<string, string> {
  const t = getMikeToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export interface AuthStatus {
  initialized: boolean;
  authenticated: boolean;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/status`, {
    cache: "no-store",
    credentials: "include",
    headers: { ...authHeader(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`auth/status ${res.status}`);
  return (await res.json()) as AuthStatus;
}

export async function setupPassword(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/setup`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error((await res.text()) || `setup ${res.status}`);
  const data = (await res.json()) as { token: string };
  setMikeToken(data.token);
  return data.token;
}

export async function loginWithPassword(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error((await res.text()) || `login ${res.status}`);
  const data = (await res.json()) as { token: string };
  setMikeToken(data.token);
  return data.token;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: authHeader(),
    });
  } catch {
    /* best-effort */
  }
  clearMikeToken();
}

/**
 * Helper for surfaces that need to react to a 401: clears the local token
 * and (in the browser) redirects to /login.
 */
export function handleUnauthorized(): void {
  clearMikeToken();
  if (typeof window !== "undefined") {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
}
