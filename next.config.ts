import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            // Recording takes are passed as base64 audio to analyzeAudioStructure —
            // Next's default 1MB Server Action body limit rejects anything past a
            // few seconds of audio, so raise it to Groq's own 25MB ceiling.
            bodySizeLimit: '25mb',
        },
    },
};

export default nextConfig;
