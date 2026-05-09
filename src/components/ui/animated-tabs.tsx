"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

export function AnimatedTabs({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: Tab[], 
  activeTab: string, 
  onChange: (id: string) => void 
}) {
  return (
    <div className="flex space-x-1 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-full p-1 max-w-fit mx-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative rounded-full px-6 py-2 text-sm font-medium transition-colors outline-none",
            activeTab === tab.id ? "text-white" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="active-tab-indicator"
              className="absolute inset-0 bg-[var(--accent)] rounded-full shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 mix-blend-exclusion">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
