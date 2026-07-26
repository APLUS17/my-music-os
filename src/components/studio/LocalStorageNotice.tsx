"use client";

import { useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "lyriq_local_storage_notice_dismissed";

function readDismissed() {
  if (typeof window === "undefined") return true;
  try {
    return !!localStorage.getItem(DISMISS_KEY);
  } catch {
    return true;
  }
}

export function LocalStorageNotice() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // best-effort only
    }
    setDismissed(true);
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto flex items-start gap-3 px-4 py-2.5 text-xs text-amber-200">
        <span className="flex-1 leading-relaxed">
          <strong className="font-semibold">Alpha limitation:</strong> your beats and voice
          recordings are stored on this device only, not backed up to the cloud yet. Avoid
          clearing browser data, private browsing, or switching devices — you&apos;ll lose
          them permanently.
        </span>
        <button
          onClick={dismiss}
          className="shrink-0 text-amber-200/70 hover:text-amber-100 transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
