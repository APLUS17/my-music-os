# Flow ↔ Write Sync Architecture

## What Changed

Previously, **Flow** and **Write** were two separate modes with two separate data sources:
- **Flow** used `sandboxLines` (unstructured writing)
- **Write** used `sections` (structured verses/choruses)

This created fragmentation—edits in one mode didn't appear in the other.

## The New System: "One Song, Two Lenses"

Now, **both modes share the same data**: `sections`.

- **Flow Mode**: Shows `sections` as a clean, unstructured writing surface (like a blank page)
- **Write Mode**: Shows `sections` as structured cards with headers, controls, and playback

## How It Works

### Flow Mode (SandboxView)
1. **Flattens** `sections` into editable lines
   - Each section's text is split by `\n` into individual lines
   - Each line remembers which section it belongs to

2. **On edit**, converts lines back to sections
   - Groups lines by their parent section
   - Joins them with `\n` to rebuild section text
   - Updates sections via `onUpdateSections()`

3. **Result**: You write freely, and the structure is maintained invisibly

### Write Mode (LyricCard)
- Directly edits `section.text` in structured cards
- No conversion needed—it's already the source of truth

## User Experience

### On New Project Open
- **Defaults to Flow mode** (blank canvas)
- First section is initialized as `{ type: 'verse', text: '' }`
- User can just start typing with zero friction

### Switching Modes
- **Flow → Write**: Text you wrote appears in verse/chorus cards
- **Write → Flow**: Structured lyrics appear as a clean writing surface
- **No data loss**: Edits in either mode sync instantly

### Recording
- In Flow mode, mic button appears next to each line
- Recording attaches to the parent section via `pinnedTakeId`
- In Write mode, same recording is visible in the card header

## Benefits

✅ **No fragmentation** - One source of truth  
✅ **Instant sync** - Edit anywhere, see everywhere  
✅ **Zero friction** - Flow mode feels like a blank page  
✅ **Power when needed** - Write mode adds structure without losing simplicity  
✅ **Natural workflow** - Write messy → refine later

## Technical Notes

- Removed: `sandboxLines` state, `SandboxLine` type
- Flow mode dynamically generates line IDs: `{sectionId}-line-{index}`
- Line→Section conversion uses a `Map<sectionId, text>` for grouping
- Default mode: `'flow'` (changed from `'arrange'`)
