// Frontend-side wrapper around the shared MikeClient. Pulls the auth token
// from the local-password session stored in localStorage. NEXT_PUBLIC_API_BASE_URL
// is set by Electron at launch (port-mapped) and falls back to localhost for
// `next dev`.

"use client";

import { MikeClient } from "@mike/shared";
import { API_BASE, getMikeToken, handleUnauthorized } from "@/lib/mikeAuth";

export const mike = new MikeClient({
  baseUrl: API_BASE,
  getAuthToken: async () => getMikeToken(),
});

// Lightweight 401 hook: every request goes through MikeClient.request, which
// throws MikeApiError on non-2xx. Surfaces that want auto-redirect-on-401 can
// wrap their calls with this.
export async function withUnauthorizedRedirect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 401) {
      handleUnauthorized();
    }
    throw e;
  }
}
