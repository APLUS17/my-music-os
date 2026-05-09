import { cn } from "@/lib/utils";
import React from "react";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[12rem] grid-cols-1 md:grid-cols-3 gap-4 mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "row-span-1 rounded-3xl group/bento transition duration-200 shadow-sm p-5 bg-[var(--bg-secondary)] border border-[var(--border-main)] relative overflow-hidden flex flex-col justify-between",
        "before:absolute before:inset-0 before:bg-gradient-to-b before:from-[var(--accent)]/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        className
      )}
    >
      {header && <div className="mb-4">{header}</div>}
      <div className="z-10 relative flex flex-col h-full justify-between">
        {icon && <div className="mb-2 text-[var(--text-tertiary)]">{icon}</div>}
        <div>
          <div className="font-medium text-[var(--text-main)] mb-1">
            {title}
          </div>
          <div className="font-normal text-[var(--text-tertiary)] text-xs">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
};
