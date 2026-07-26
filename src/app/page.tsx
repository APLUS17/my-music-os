"use client";

import StudioWorkspace from "@/components/studio/StudioWorkspace";
import AuthGate from "@/components/studio/AuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocalStorageNotice } from "@/components/studio/LocalStorageNotice";
import { useAuth } from "@/contexts/AuthContext";

export default function Page() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-xs uppercase tracking-widest text-white/30">Loading…</div>
            </div>
        );
    }

    if (!user) {
        return <AuthGate />;
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg-main)]">
                <LocalStorageNotice />
                <StudioWorkspace />
            </div>
        </ErrorBoundary>
    );
}
