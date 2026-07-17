import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Server Actions invoked from this page (analyzeAudioStructure, chatWithFacilitator)
// run as long as Gemini audio analysis needs, up to the platform's own ceiling.
export const maxDuration = 300;

export default function Page() {
    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg-main)]">
                <StudioWorkspace />
            </div>
        </ErrorBoundary>
    );
}
