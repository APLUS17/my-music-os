export class AIService {
    private isMock: boolean = true;

    async generateIdea(prompt: string): Promise<string> {
        if (this.isMock) {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            return this.getMockResponse(prompt);
        }
        return "Real AI response placeholder";
    }

    private getMockResponse(prompt: string): string {
        const responses = [
            "Try a I-VI-IV-V progression in the key of F# Minor.",
            "Concept: A song about the feeling of waking up before the alarm.",
            "Lyric Seed: 'Echoes in the hallway, shadows on the floor...'",
            "Production Tip: Add a high-pass filter to the reverb return.",
            "Visual: Neon rain falling on a vintage synthesiszer."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

export const ai = new AIService();
