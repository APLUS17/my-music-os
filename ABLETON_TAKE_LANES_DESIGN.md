# Ableton-Inspired Take Lanes Design

## Visual Concept
Nested Layers Within a Session
Instead of separate sessions or checkboxes, layers stack vertically inside the same card - just like Ableton's take lanes sit beneath the main lane:

┌─────────────────────────────────────────────────┐
│ ▶  Verse Take                      12:34 • 8.2s │  ← Main Lane (audible)
│    ┌─────────────────────────────────────────┐  │
│    │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░ │  │  ← Waveform
│    └─────────────────────────────────────────┘  │
│                                                 │
│    ┌─ LAYERS ──────────────────────────────┐   │
│    │ 🎤 Layer 1 (Lead)     ━━━━━━━━━━━━━━━ │   │  ← Full color = active
│    │ 🎵 Layer 2 (Harmony)  ━━━━━━━━━━━━━━━ │   │  ← Desaturated = muted  
│    │ ✨ Layer 3 (Ad-libs)  ━━━━━━━━━━━━━━━ │   │
│    │                    [+ Add Layer]       │   │
│    └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘

## Key UX Principles
- **Color saturation = active state**: Full color means it plays, desaturated means muted. No checkboxes needed - just tap to toggle.
- **Layers are attached, not separate**: Each layer belongs to a parent session, not floating independently.
- **One-tap layering**: "Add Layer" opens the recorder with the existing layers playing back, so you hear them while recording.
- **Visual hierarchy**: Main lane is prominent, layers are indented below.

## Data Model Change
Add layers to `RecordingSession`:

```typescript
export interface RecordingLayer {
    id: string;
    name?: string;
    audioUrl?: string;
    base64?: string;
    duration?: number;
    isMuted: boolean;      // Desaturated when true
    gain?: number;         // 0-1 volume
}

export interface RecordingSession {
    // ... existing fields
    layers?: RecordingLayer[];  // NEW - additional vocal layers
}
```

## Flow for Adding a Layer
1. User taps "+ Add Layer" on an existing `SessionCard`
2. `RecorderDrawer` opens with `layerMode: true`
3. While recording, all unmuted layers + beat play back in headphones
4. On save, new recording is appended to `session.layers[]`
5. Card refreshes showing the new nested layer

## Implementation Phases
### Phase 1 - RecorderDrawer Enhancement
- Accept `existingLayers: RecordingLayer[]` prop
- Play them back (mixed via Web Audio) while recording
- Return new blob tagged as a layer

### Phase 2 - SessionCard Layer UI
- Show nested layers below the waveform
- Tap layer = toggle mute (color saturation change)
- Long-press or swipe = delete layer
- "+ Add Layer" button at bottom

### Phase 3 - Mixed Playback
- When playing a session, mix all unmuted layers via `GainNode[]`
- Per-layer volume slider (optional, can add later)
