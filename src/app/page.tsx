import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { FlowProvider } from "@/components/studio/flow/FlowContext";

export default function Page() {
    return (
        <div className="min-h-screen bg-[var(--bg-main)]">
            <FlowProvider>
                <StudioWorkspace />
            </FlowProvider>
        </div>
    );
}
