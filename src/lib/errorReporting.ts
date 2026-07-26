export function reportClientError(message: string, stack?: string, context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ message, stack, url: window.location.href, context });
    const sent = navigator.sendBeacon?.(
      "/api/log-error",
      new Blob([payload], { type: "application/json" })
    );
    if (!sent) {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // best-effort only — error reporting must never itself throw
  }
}
