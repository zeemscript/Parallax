/**
 * safeRedirectTarget validates a `next` redirect target coming from a sign-in
 * URL before the app navigates to it.
 *
 * Only same-origin, path-only values are accepted: a single leading `/` not
 * followed by `/` or `\`, and no scheme. Anything else falls back to the
 * fallback destination, so the sign-in page cannot be used as an open
 * redirect (`/login?next=//example.com`).
 */
export function safeRedirectTarget(next: string | null | undefined, fallback = '/explore'): string {
  if (!next) return fallback;

  // A path-only target must start with a single `/`.
  if (next[0] !== '/') return fallback;

  // `//example.com` is a protocol-relative URL and `/\example.com` is treated
  // the same way by browsers that normalise backslashes in paths — both are
  // cross-origin.
  if (next[1] === '/' || next[1] === '\\') return fallback;

  // Keep the login page from redirecting to itself.
  if (next.startsWith('/login')) return fallback;

  return next;
}
