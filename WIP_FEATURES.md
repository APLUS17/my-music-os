# Work In Progress (WIP) Features

## 🧠 Muse (AI Assistant)
The `MuseDrawer` component is fully functional but currently **disabled** for the Beta release.
To re-enable it in `StudioWorkspace.tsx`, follow these steps:

### 1. Import the Component
Add this back to the top of `src/components/studio/StudioWorkspace.tsx`:
```tsx
import { MuseDrawer } from './MuseDrawer';
```

### 2. Add State Management
Add this state variable inside the `StudioWorkspace` component:
```tsx
const [showMuse, setShowMuse] = useState(false);
```

### 3. Add the Trigger Button
Add the "Zap" button back to the header (next to `BeatUploader`):
```tsx
<button
    onClick={() => setShowMuse(true)}
    className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--accent)] hover:text-[var(--text-main)]"
>
    <Zap size={18} fill="currentColor" />
</button>
```

### 4. Render the Component
Add the drawers back near the bottom of the return statement (before `FeedbackModal`):
```tsx
{showMuse && (
    <MuseDrawer 
        onClose={() => setShowMuse(false)} 
        contextText={sections.map(s => s.text).join('\n')} 
    />
)}
```

---

## 🎙️ Studio Facilitator (AI Assistant)
We have implemented the core backend for the **Studio Facilitator** in `src/app/actions.ts`:
*   **Audio Structure Analysis**: Uses Gemini 2.0 Flash to identify Verse/Chorus/Bridge from uploaded audio.
*   **Conversational Logic**: `chatWithFacilitator` action provides a high-velocity songwriting coach framework.
*   **WIP Frontend**: The `FacilitatorView` component is currently being polished for better integration with the Studio tab.

---

## 🎹 Other Hidden Features
*   **Share Button**: Currently removed from the header. Needs link-generation logic.
*   **BPM & Key Display**: Needs connection to real project metadata.
*   **Supabase Types**: Backend is connected but requires manual type casting (`as any`) until full schema generation is integrated.

---

## 🗄️ Archived & Hidden UI Elements
The following elements have been archived or hidden to simplify layout clutter, clean up vertical space, or prevent navigation overlaps:
*   **Repeats Indicator & Buttons (`x2 | + -`)**: Removed from the header of each `LyricCard.tsx` to clean up structured writing card space.
*   **Category Selector Dropdown & Line/Syllable Summary Bar**: Removed from above the lyric card list in `StudioWorkspace.tsx` to maximize vertical space for mobile writing.
*   **Empty State Centered Button**: Removed the centered "Add Lyric Section" button that appeared when the workspace had zero lyric cards. The app now directly displays the write-mode editor canvas and relies on the standard `+ Add Section` button at the bottom of the list.
*   **Player Tab Action Buttons**: Removed the chat (`MessageSquare`), language translation (`Languages`), and menu list (`List`) icons from the bottom action bar of `PlayerTab.tsx` as they were overlapping with the centered floating bottom navigation pill. Replace with a `<div className="h-20" />` spacer.
*   **Global Search Icon**: Replaced with the theme toggle in the main Studio header.
*   **Borderless Syllable Toggle Button ("T")**: Removed the circle border ring, active background color, and active glow shadow from the syllable toggle button. It now remains completely transparent, toggling only the text color of the letter "T" itself to the active accent color.
*   **"Capture the Flow" greeting, illustrator & quick start tags**: Hidden from normal blank states and moved exclusively inside the active onboarding tour sequence (`showTour === true`).

