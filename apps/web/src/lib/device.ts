// A stable, anonymous per-browser id that ties a push subscription to this
// device. Generated once and persisted in localStorage.
const KEY = "wow-locker:device";

let cached: string | null = null;

/**
 * A v4-shaped UUID that also works in INSECURE contexts. `crypto.randomUUID` is
 * only defined over HTTPS/localhost, so on a phone hitting the dev server over
 * plain-http LAN (http://<mac-ip>:5173) it's `undefined`. `crypto.getRandomValues` IS available in
 * insecure contexts, so we build the UUID from it and only fall back to
 * Math.random if crypto is entirely absent.
 */
function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h
      .slice(8, 10)
      .join("")}-${h.slice(10, 16).join("")}`;
  }
  return `anon-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId(): string {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    cached = id;
    return id;
  } catch {
    // localStorage unavailable (private mode) — a per-session id still works
    // for this tab; it just won't persist across reloads.
    cached = cached ?? uuid();
    return cached;
  }
}
