const RECENT_SCRUBBED_TOKENS = new Map();
const SCRUB_CACHE_TTL_MS = 3000;

/**
 * Extracts a sensitive token from `window.location.hash` (`#token=...`), falling back
 * to `?token=...` or a legacy route parameter, and immediately scrubs the URL bar
 * via `window.history.replaceState` so tokens never linger in history or referrers.
 */
export function readFragmentToken({ paramToken = "", cleanPath } = {}) {
  if (typeof window === "undefined") {
    return typeof paramToken === "string" ? paramToken.trim() : "";
  }

  const targetCleanPath = cleanPath || window.location.pathname || "/";
  let token = "";

  const hash = window.location.hash || "";
  if (hash) {
    const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
    const hashParams = new URLSearchParams(rawHash);
    const fromHash = hashParams.get("token");
    if (fromHash && fromHash.trim()) {
      token = fromHash.trim();
    } else if (rawHash && !rawHash.includes("=")) {
      try {
        token = decodeURIComponent(rawHash).trim();
      } catch {
        token = rawHash.trim();
      }
    }
  }

  if (!token && window.location.search) {
    const fromQuery = new URLSearchParams(window.location.search).get("token");
    if (fromQuery && fromQuery.trim()) {
      token = fromQuery.trim();
    }
  }

  if (!token && typeof paramToken === "string" && paramToken.trim()) {
    token = paramToken.trim();
  }

  if (token) {
    RECENT_SCRUBBED_TOKENS.set(targetCleanPath, { token, at: Date.now() });
    if (window.history?.replaceState) {
      const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentFull !== targetCleanPath) {
        window.history.replaceState(null, "", targetCleanPath);
      }
    }
    return token;
  }

  const cached = RECENT_SCRUBBED_TOKENS.get(targetCleanPath);
  if (cached && Date.now() - cached.at <= SCRUB_CACHE_TTL_MS) {
    return cached.token;
  }
  RECENT_SCRUBBED_TOKENS.delete(targetCleanPath);
  return "";
}
