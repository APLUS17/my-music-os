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

## 🎹 Other Hidden Features
*   **Share Button**: Currently removed from the header to reduce clutter. Code for sharing logic (generating link/image) needs to be implemented.
*   **BPM & Key Display**: Currently removed as it was using mock data. Needs to be connected to real project metadata or beat analysis.
