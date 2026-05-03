import { createClient } from "./supabase/client";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "/");
const INSTALLED = Symbol.for("gomate.installAuthFetch.installed");

function toPathname(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function isApiPathname(pathname: string): boolean {
  if (BASE !== "/" && pathname.startsWith(BASE)) {
    return pathname.slice(BASE.length - 1).startsWith("/api/");
  }
  return pathname.startsWith("/api/");
}

function rewriteUrl(url: string): string {
  if (BASE === "/") return url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.pathname.startsWith("/api/") && !u.pathname.startsWith(BASE)) {
      u.pathname = BASE + u.pathname.slice(1);
      return u.toString();
    }
    return u.toString();
  } catch {
    if (url.startsWith("/api/")) return BASE + url.slice(1);
    return url;
  }
}

export function installAuthFetch() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<symbol, unknown>;
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr: string;
    let baseInit: RequestInit | undefined = init;
    let baseHeaders: HeadersInit | undefined;

    if (typeof input === "string") {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else {
      const req = input as Request;
      urlStr = req.url;
      baseHeaders = req.headers;
    }

    const pathname = toPathname(urlStr);
    if (!isApiPathname(pathname)) return originalFetch(input, init);

    const targetUrl = rewriteUrl(urlStr);

    let token: string | null = null;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      // Supabase env missing — pass through unchanged
    }

    const headers = new Headers(init?.headers || baseHeaders || undefined);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (input instanceof Request && targetUrl !== urlStr) {
      return originalFetch(new Request(targetUrl, input), { ...baseInit, headers });
    }
    return originalFetch(targetUrl, { ...baseInit, headers });
  };
}
