import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LyricSection, LyricScrap, VoiceTake, SectionType } from './types';
import { LyricCard } from './components/LyricCard';
import { RecorderDrawer } from './components/RecorderDrawer';
import { SandboxView } from './components/SandboxView';
import { PuzzleView } from './components/PuzzleView';
import { VoiceMemoView } from './components/VoiceMemoView';
import { BeatUploader } from './components/BeatUploader';
import { GeminiPanel } from './components/GeminiPanel';
import { 
  LayoutGrid, 
  Mic, 
  PenTool, 
  Library,
  Search,
  Zap,
  X,
  ChevronRight,
  Command,
  Settings,
  Check,
  Plus,
  Music,
  Upload,
  FilePlus,
  Share,
  Fingerprint,
  MoreVertical
} from 'lucide-react';

type ViewMode = 'collection' | 'studio' | 'board' | 'settings';
type StudioMode = 'flow' | 'arrange';
type LibraryTab = 'songs' | 'takes' | 'beats';
type Theme = 'dark' | 'light' | 'midnight' | 'terminal' | 'ethereal';

interface SavedProject {
  id: string;
  title: string;
  bpm: string;
  key: string;
  date: string;
  preview: string;
  data: {
    sections: LyricSection[];
    scraps: LyricScrap[];
    sandboxText: string;
  };
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [viewMode, setViewMode] = useState<ViewMode>('studio');
  const [studioMode, setStudioMode] = useState<StudioMode>('flow');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('songs');
  
  const [showRecorder, setShowRecorder] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedBeat, setUploadedBeat] = useState<string | null>(null);
  
  const [fabOpen, setFabOpen] = useState(false);
  const fabInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Project Meta
  const [projectTitle, setProjectTitle] = useState("New Composition");
  const [projectBpm, setProjectBpm] = useState("120");
  const [projectKey, setProjectKey] = useState("C Min");
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const [sections, setSections] = useState<LyricSection[]>([]);
  const [scraps, setScraps] = useState<LyricScrap[]>([]);
  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [beats, setBeats] = useState<Array<{id: string, name: string, src: string, date: string}>>([]);
  const [sandboxText, setSandboxText] = useState("");
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  useEffect(() => {
    const savedData = localStorage.getItem('studio-pro-data-v2');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.scraps) setScraps(parsed.scraps);
        if (parsed.sandboxText) setSandboxText(parsed.sandboxText);
        if (parsed.savedProjects) setSavedProjects(parsed.savedProjects);
        if (parsed.projectTitle) setProjectTitle(parsed.projectTitle);
        if (parsed.projectBpm) setProjectBpm(parsed.projectBpm);
        if (parsed.projectKey) setProjectKey(parsed.projectKey);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      sections,
      scraps,
      sandboxText,
      savedProjects,
      projectTitle,
      projectBpm,
      projectKey
    };
    localStorage.setItem('studio-pro-data-v2', JSON.stringify(dataToSave));
  }, [sections, scraps, sandboxText, savedProjects, projectTitle, projectBpm, projectKey]);

  const handleSaveTake = (blob: Blob, duration: number) => {
    const url = URL.createObjectURL(blob);
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const newTake: VoiceTake = {
      id,
      timestamp,
      duration: durationStr,
      transcription: "",
      associatedLyrics: '',
      isPlaying: false,
      audioUrl: url
    };
    setTakes(prev => [newTake, ...prev]);
  };

  const handleAudioImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const id = Math.random().toString(36).substr(2, 6).toUpperCase();
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        const duration = tempAudio.duration;
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        const newTake: VoiceTake = {
          id,
          timestamp,
          duration: durationStr,
          transcription: "",
          associatedLyrics: '',
          isPlaying: false,
          audioUrl: url
        };
        setTakes(prev => [newTake, ...prev]);
      };
    }
  };

  const handleTapBpm = () => {
    const now = Date.now();
    const newTaps = [...tapTimes, now].filter(t => now - t < 2000).slice(-4);
    setTapTimes(newTaps);
    if (newTaps.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b) / intervals.length;
      setProjectBpm(Math.round(60000 / avg).toString());
    }
  };

  const handleExport = () => {
    const content = `TITLE: ${projectTitle}\nBPM: ${projectBpm}\nKEY: ${projectKey}\n\n` + 
      sections.map(s => `[${s.type.toUpperCase()}${s.repeats > 1 ? ` x${s.repeats}` : ''}]\n${s.text}`).join('\n\n') +
      (sandboxText ? `\n\n[SANDBOX / IDEAS]\n${sandboxText}` : '');
    
    navigator.clipboard.writeText(content);
    alert("Project structure & lyrics copied to clipboard!");
  };

  const onUpdateTake = (id: string, updates: Partial<VoiceTake>) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const archiveCurrentProject = () => {
     if (sections.length === 0 && scraps.length === 0 && !sandboxText) return;
     const newProject: SavedProject = {
         id: Math.random().toString(36).substr(2, 9),
         title: projectTitle,
         bpm: projectBpm,
         key: projectKey,
         date: new Date().toLocaleDateString(),
         preview: `${sections.length} sections • ${scraps.length} scraps`,
         data: { sections, scraps, sandboxText }
     };
     setSavedProjects(prev => [newProject, ...prev]);
  };

  const handleNewProject = () => {
    setFabOpen(false);
    archiveCurrentProject();
    setSections([]);
    setScraps([]);
    setSandboxText("");
    setProjectTitle("New Composition");
    setProjectBpm("120");
    setProjectKey("C Min");
    setUploadedBeat(null);
    setStudioMode('flow');
    setViewMode('studio');
  };

  const loadProject = (p: SavedProject) => {
    if (window.confirm(`Load "${p.title}"? Workspace will sync.`)) {
        setSections(p.data.sections);
        setScraps(p.data.scraps);
        setSandboxText(p.data.sandboxText);
        setProjectTitle(p.title);
        setProjectBpm(p.bpm);
        setProjectKey(p.key);
        setViewMode('studio');
    }
  };

  const handleBeatUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const newBeat = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name.replace(/\.[^/.]+$/, ""),
      src: url,
      date: new Date().toLocaleDateString()
    };
    setBeats(prev => [newBeat, ...prev]);
    setUploadedBeat(url);
  };

  const handleLibraryBeatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFabOpen(false);
    if (e.target.files?.[0]) {
        handleBeatUpload(e.target.files[0]);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery) return { sections: [], scraps: [], takes: [] };
    const q = searchQuery.toLowerCase();
    return {
      sections: sections.filter(s => s.text.toLowerCase().includes(q)),
      scraps: scraps.filter(s => s.text.toLowerCase().includes(q)),
      takes: takes.filter(t => (t.transcription || "").toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    };
  }, [searchQuery, sections, scraps, takes]);

  const updateSection = (id: string, updates: Partial<LyricSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setSections(newSections);
  };

  const deleteSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));
  
  const addSection = () => {
    setSections(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: 'verse',
      repeats: 1,
      text: ""
    }]);
  };

  const promoteToSection = () => {
    if (sandboxText.trim()) {
      const newSection: LyricSection = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'verse',
        repeats: 1,
        text: sandboxText
      };
      setSections(prev => [...prev, newSection]);
      setSandboxText("");
      setStudioMode('arrange');
    }
  };

  const getActiveView = () => {
    switch (viewMode) {
      case 'settings':
        return (
           <div className="h-full flex flex-col pt-12 animate-in fade-in duration-500 px-6">
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setViewMode('collection')} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">Settings</h1>
              </div>
              <div className="space-y-8 overflow-y-auto pb-20">
                 <section>
                    <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Appearance</h2>
                    <div className="grid grid-cols-1 gap-3">
                       {[
                         { id: 'dark', name: 'Carbon', desc: 'DEFAULT DARK', bg: '#050505' },
                         { id: 'light', name: 'Paper', desc: 'CLEAN LIGHT', bg: '#F5F5F4' },
                         { id: 'midnight', name: 'Azure', desc: 'CYBER BLUE', bg: '#020617' },
                         { id: 'terminal', name: 'Terminal', desc: 'RETRO LO-FI', bg: '#000000' },
                         { id: 'ethereal', name: 'Ethereal', desc: 'SOFT SERIF', bg: '#FFF1F2' },
                       ].map(t => (
                        <button 
                          key={t.id}
                          onClick={() => setTheme(t.id as Theme)} 
                          className={`p-4 rounded-lg border flex items-center justify-between transition-all ${theme === t.id ? 'bg-[var(--bg-card)] border-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border-main)] hover:border-[var(--text-secondary)]'}`}
                        >
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: t.bg }} />
                              <div className="text-left">
                                 <p className="text-sm font-medium text-[var(--text-main)]">{t.name}</p>
                                 <p className="text-[10px] mono text-[var(--text-secondary)]">{t.desc}</p>
                              </div>
                           </div>
                           {theme === t.id && <Check size={16} className="text-[var(--accent)]" />}
                        </button>
                       ))}
                    </div>
                 </section>
              </div>
           </div>
        );
      case 'collection':
        return (
          <div className="h-full flex flex-col pt-12 animate-in fade-in duration-500">
            <div className="px-6 mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)] mb-6">Library</h1>
                <div className="flex border-b border-[var(--border-main)]">
                  <button onClick={() => setLibraryTab('songs')} className={`pb-3 pr-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'songs' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Projects</button>
                  <button onClick={() => setLibraryTab('takes')} className={`pb-3 px-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'takes' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Takes</button>
                  <button onClick={() => setLibraryTab('beats')} className={`pb-3 px-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'beats' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Beats</button>
                </div>
              </div>
              <button onClick={() => setViewMode('settings')} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"><Settings size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-32 scrollbar-hide">
              {libraryTab === 'takes' && (
                <div className="space-y-4">
                   <div className="relative group">
                     <button onClick={() => audioInputRef.current?.click()} className="w-full py-6 border border-dashed border-[var(--border-main)] rounded-lg flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all">
                        <Upload size={20} />
                        <span className="text-[10px] mono uppercase tracking-wider">Import Recording</span>
                        <input ref={audioInputRef} type="file" accept="audio/*, .mp3, .wav, .m4a, .aac" className="hidden" onChange={handleAudioImport} />
                     </button>
                   </div>
                   <VoiceMemoView takes={takes} onUpdateTake={onUpdateTake} />
                </div>
              )}
              {libraryTab === 'songs' && (
                <div className="space-y-4">
                   <div onClick={() => setViewMode('studio')} className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-[var(--text-tertiary)] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-main)]"><PenTool size={18} /></div>
                        <div>
                          <h3 className="text-sm font-medium text-[var(--text-main)] mb-1">{projectTitle}</h3>
                          <p className="text-[10px] mono text-[var(--accent)]">ACTIVE SESSION</p>
                        </div>
                      </div>
                   </div>
                   {savedProjects.map(p => (
                       <div key={p.id} onClick={() => loadProject(p)} className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg p-4 flex items-center justify-between cursor-pointer opacity-80 hover:opacity-100 transition-all">
                          <div>
                            <h3 className="text-sm font-medium text-[var(--text-main)] mb-1">{p.title}</h3>
                            <p className="text-[10px] mono text-[var(--text-tertiary)]">{p.date} • {p.bpm} BPM</p>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                       </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'board':
        return <PuzzleView scraps={scraps} onAdd={(text, type) => setScraps([{id: String(Date.now()), text, type}, ...scraps])} onUpdateType={() => {}} />;
      case 'studio':
        return (
          <div className="h-full flex flex-col animate-in fade-in duration-500 relative">
            {/* Unified Session Header */}
            <div className="glass z-20 sticky top-0 border-b border-[var(--border-main)]">
              <div className="px-6 py-4 space-y-4">
                <div className="flex items-start justify-between">
                   <div className="flex-1 min-w-0 mr-4">
                     <input 
                        value={projectTitle} 
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="bg-transparent border-none text-lg font-medium text-[var(--text-main)] focus:outline-none w-full placeholder:text-[var(--text-tertiary)]"
                        placeholder="Untitled Project"
                      />
                     <div className="flex items-center gap-3 mt-1 text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-main)]">
                           <span>BPM</span>
                           <input value={projectBpm} onChange={(e) => setProjectBpm(e.target.value)} className="bg-transparent w-8 focus:outline-none text-[var(--text-main)]" />
                        </div>
                        <span className="text-[var(--border-main)]">|</span>
                        <div className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-main)]">
                           <span>KEY</span>
                           <input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} className="bg-transparent w-10 focus:outline-none text-[var(--text-main)]" />
                        </div>
                        <button onClick={handleTapBpm} className="ml-2 text-[var(--accent)] hover:bg-[var(--bg-hover)] rounded flex items-center gap-1" title="Tap Tempo">
                         <Fingerprint size={12} />
                        </button>
                     </div>
                   </div>
                   <button 
                    onClick={handleExport}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors rounded-full hover:bg-[var(--bg-hover)]"
                    title="Export Text"
                   >
                     <Share size={16} />
                   </button>
                </div>
                
                {/* Embedded Beat Player */}
                <BeatUploader audioSrc={uploadedBeat} onUpload={handleBeatUpload} onClear={() => setUploadedBeat(null)} />
                
                {/* Mode Switcher */}
                <div className="flex items-center justify-between pt-1">
                   <div className="flex bg-[var(--bg-secondary)] p-0.5 rounded-lg border border-[var(--border-main)]">
                      <button 
                        onClick={() => setStudioMode('flow')} 
                        className={`px-4 py-1.5 rounded-md text-[10px] mono uppercase tracking-wider transition-all ${studioMode === 'flow' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                      >
                        Flow
                      </button>
                      <button 
                        onClick={() => setStudioMode('arrange')} 
                        className={`px-4 py-1.5 rounded-md text-[10px] mono uppercase tracking-wider transition-all ${studioMode === 'arrange' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                      >
                        Structure
                      </button>
                   </div>
                   
                   <button 
                      onClick={() => setShowGemini(!showGemini)} 
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all border border-transparent ${showGemini ? 'bg-[var(--text-main)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'}`}
                    >
                      <Zap size={12} fill={showGemini ? "currentColor" : "none"} />
                      <span className="text-[10px] mono uppercase tracking-wider hidden sm:inline">AI</span>
                   </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 px-6 overflow-y-auto scrollbar-hide pb-32 pt-6 relative">
               {studioMode === 'flow' ? (
                 <SandboxView text={sandboxText} onChange={setSandboxText} onPromote={promoteToSection} />
               ) : (
                 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {sections.length === 0 && (
                       <div className="py-20 flex flex-col items-center justify-center border border-dashed border-[var(--border-main)] rounded-xl opacity-60">
                         <LayoutGrid size={24} className="text-[var(--text-tertiary)] mb-3" />
                         <p className="text-[10px] mono text-[var(--text-tertiary)] uppercase tracking-widest">No Structure</p>
                       </div>
                    )}
                    {sections.map(s => <LyricCard key={s.id} section={s} onUpdate={updateSection} onDelete={deleteSection} onMove={moveSection} availableTakes={takes} />)}
                    <button onClick={addSection} className="w-full py-4 border border-dashed border-[var(--border-main)] rounded-lg text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all group">
                      <span className="group-hover:tracking-[0.2em] transition-all duration-300">+ Add Section</span>
                    </button>
                 </div>
               )}
            </div>
            {showGemini && <GeminiPanel onClose={() => setShowGemini(false)} contextText={studioMode === 'flow' ? sandboxText : sections.map(s => s.text).join(' ')} />}
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center overflow-hidden select-none transition-colors duration-500" data-theme={theme}>
      <div className="relative w-full max-w-[440px] h-full flex flex-col border-x border-[var(--border-main)] shadow-2xl bg-[var(--bg-main)]">
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {getActiveView()}
          
          {/* Floating Action Button & Overlay */}
          {viewMode === 'collection' && (
             <div className="absolute bottom-24 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
                <div className="pointer-events-auto flex flex-col items-end gap-3">
                   {fabOpen && (
                      <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
                        <button onClick={handleNewProject} className="flex items-center gap-3 group">
                           <span className="bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg">New Project</span>
                           <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)]"><FilePlus size={16} /></div>
                        </button>
                        <button onClick={() => fabInputRef.current?.click()} className="flex items-center gap-3 group">
                           <span className="bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg">Import Beat</span>
                           <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)]"><Music size={16} /></div>
                           <input ref={fabInputRef} type="file" accept="audio/*, .mp3, .wav" className="hidden" onChange={handleLibraryBeatUpload} />
                        </button>
                      </div>
                   )}
                   <button onClick={() => setFabOpen(!fabOpen)} className="w-14 h-14 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] shadow-xl flex items-center justify-center active:scale-95 transition-all z-50 hover:brightness-110">
                      <Plus size={24} className={`transition-transform duration-300 ${fabOpen ? 'rotate-45' : ''}`} />
                   </button>
                </div>
                {fabOpen && <div className="fixed inset-0 z-[-1] bg-black/20 backdrop-blur-[1px] pointer-events-auto" onClick={() => setFabOpen(false)} />}
             </div>
          )}
        </main>

        {showSearch && (
          <div className="absolute inset-0 z-50 bg-[var(--glass)] backdrop-blur-md p-4 pt-16 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center px-4 py-4 border-b border-[var(--border-main)]">
                   <Search size={16} className="text-[var(--text-secondary)] mr-3" />
                   <input autoFocus type="text" placeholder="Search lyrics, takes..." className="bg-transparent text-[var(--text-main)] focus:outline-none text-sm w-full font-sans" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                   <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-1 hover:bg-[var(--bg-hover)] rounded"><X size={14} /></button>
                </div>
            </div>
          </div>
        )}

        {showRecorder && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="w-full animate-in slide-in-from-bottom duration-500">
                <RecorderDrawer onClose={() => setShowRecorder(false)} onSave={handleSaveTake} />
             </div>
          </div>
        )}

        {/* Global Navigation */}
        {viewMode !== 'settings' && (
          <div className="absolute bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <nav className="pointer-events-auto glass rounded-2xl px-2 py-2 flex items-center gap-1 shadow-2xl border border-[var(--border-main)]/50">
              <NavBtn active={viewMode === 'collection'} onClick={() => setViewMode('collection')} icon={<Library size={18} strokeWidth={2} />} label="LIB" />
              <NavBtn active={viewMode === 'studio'} onClick={() => setViewMode('studio')} icon={<PenTool size={18} strokeWidth={2} />} label="STU" />
              
              <button onClick={() => setShowRecorder(true)} className="w-12 h-12 mx-3 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--accent-dim)]">
                <Mic size={22} strokeWidth={2} />
              </button>
              
              <NavBtn active={viewMode === 'board'} onClick={() => setViewMode('board')} icon={<LayoutGrid size={18} strokeWidth={2} />} label="BRD" />
              <button onClick={() => setShowSearch(true)} className="w-12 h-10 flex flex-col items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:bg-[var(--bg-hover)]">
                <Search size={18} strokeWidth={2} />
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

const NavBtn: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-12 h-10 flex flex-col items-center justify-center rounded-xl transition-all duration-300 ${active ? 'text-[var(--text-main)] bg-[var(--bg-hover)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
    {icon}
    {active && <div className="w-1 h-1 rounded-full bg-[var(--text-main)] mt-1" />}
  </button>
);

export default App;