"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/errorReporting";

export function ClientErrorLogger() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError(event.message, event.error?.stack, { type: "window.onerror" });
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      reportClientError(message, stack, { type: "unhandledrejection" });
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
