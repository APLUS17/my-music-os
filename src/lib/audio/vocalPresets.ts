import { FXSettings } from '@/components/studio/FXPanel';

export interface VocalPreset {
  id: string;
  name: string;
  description: string;
  settings: FXSettings;
}

export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: 'dry',
    name: 'Dry',
    description: 'Unprocessed direct signal',
    settings: { space: 0, echo: 0, punch: 0, eqLow: 0, eqMid: 0, eqHigh: 0 }
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Crisp compression, light reverb & EQ boost',
    settings: { space: 25, echo: 10, punch: 55, eqLow: 0, eqMid: 1, eqHigh: 3 }
  },
  {
    id: 'space',
    name: 'Space',
    description: 'Deep, atmospheric reverb & compression',
    settings: { space: 65, echo: 15, punch: 35, eqLow: -1, eqMid: 0, eqHigh: 4 }
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Bouncing delay lines for rap sections',
    settings: { space: 20, echo: 50, punch: 70, eqLow: 0, eqMid: 2, eqHigh: 5 }
  },
  {
    id: 'radio',
    name: 'Radio',
    description: 'Vintage telephone bandpass filter',
    settings: { space: 15, echo: 20, punch: 50, eqLow: -10, eqMid: 6, eqHigh: -3 }
  }
];
