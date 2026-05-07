import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Page() {
    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-background">
                <StudioWorkspace />
            </div>
        </ErrorBoundary>
    );
}
