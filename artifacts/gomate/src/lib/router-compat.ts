import { useLocation, useSearch } from "wouter";
import { useMemo } from "react";

export function useRouter() {
  const [, setLocation] = useLocation();
  return useMemo(
    () => ({
      push: (href: string) => setLocation(href),
      replace: (href: string) => setLocation(href, { replace: true }),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => window.location.reload(),
      prefetch: () => {},
    }),
    [setLocation],
  );
}

export function usePathname(): string {
  const [location] = useLocation();
  return location;
}

export function useSearchParams(): URLSearchParams {
  const search = useSearch();
  return useMemo(() => new URLSearchParams(search), [search]);
}
