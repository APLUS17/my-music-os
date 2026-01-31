"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * GlobalNav - Floating glass dock navigation
 * 
 * Layout: [Library] [Studio] [(Record)] [Board] [Search]
 * Per implementation_plan.md and mockup specifications
 */

interface NavItemProps {
    icon: string;
    label: string;
    href: string;
    isActive: boolean;
}

function NavItem({ icon, label, href, isActive }: NavItemProps) {
    return (
        <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center justify-center p-3 rounded-full transition-all duration-[var(--duration-fast)] cursor-pointer",
                "active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
                isActive
                    ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
        >
            <span
                className={cn(
                    "material-symbols-outlined text-[26px]",
                    isActive ? "font-medium" : "font-light"
                )}
            >
                {icon}
            </span>
        </Link>
    );
}

interface RecordButtonProps {
    onClick?: () => void;
    isRecording?: boolean;
}

function RecordButton({ onClick, isRecording }: RecordButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative w-14 h-14 rounded-full flex items-center justify-center",
                "bg-[var(--accent-cta)] text-[var(--bg-main)]",
                "-translate-y-3 shadow-[0_0_20px_rgba(34,197,94,0.4)]",
                "hover:bg-[var(--accent-cta-hover)] hover:scale-105",
                "active:scale-95 transition-all duration-[var(--duration-fast)]",
                "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-cta)]",
                isRecording && "animate-pulse-glow"
            )}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
            <span className="material-symbols-outlined text-[28px] font-medium">
                {isRecording ? "stop" : "mic"}
            </span>
        </button>
    );
}

interface GlobalNavProps {
    onRecordClick?: () => void;
    isRecording?: boolean;
}

export function GlobalNav({ onRecordClick, isRecording }: GlobalNavProps) {
    const pathname = usePathname();

    // Determine active page
    const isLibrary = pathname === "/" || pathname.startsWith("/project");
    const isStudio = pathname === "/write" || pathname.startsWith("/write");
    const isBoard = pathname === "/board" || pathname.startsWith("/board");
    const isSearch = pathname === "/search" || pathname.startsWith("/search");

    return (
        <nav
            className="fixed bottom-6 left-6 right-6 z-[var(--z-fixed)]"
            role="navigation"
            aria-label="Main navigation"
        >
            <div
                className={cn(
                    "max-w-[420px] mx-auto h-[68px]",
                    "glass-nav rounded-full",
                    "flex items-center justify-evenly",
                    "shadow-2xl shadow-black/50"
                )}
            >
                {/* Library */}
                <NavItem
                    icon="library_music"
                    label="Library"
                    href="/"
                    isActive={isLibrary}
                />

                {/* Studio */}
                <NavItem
                    icon="edit_note"
                    label="Studio"
                    href="/write"
                    isActive={isStudio}
                />

                {/* Record Button (Center) */}
                <RecordButton onClick={onRecordClick} isRecording={isRecording} />

                {/* Board */}
                <NavItem
                    icon="dashboard"
                    label="Board"
                    href="/board"
                    isActive={isBoard}
                />

                {/* Search */}
                <NavItem
                    icon="search"
                    label="Search"
                    href="/search"
                    isActive={isSearch}
                />
            </div>
        </nav>
    );
}

export default GlobalNav;
