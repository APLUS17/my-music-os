import React, { useState, useRef, useEffect } from 'react';
import { VoiceTake } from '@/types';
import { Play, Pause, MoreHorizontal, Download, Zap, Loader2, Edit3 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface VoiceMemoViewProps {
  takes: VoiceTake[];
  onUpdateTake: (id: string, updates: Partial<VoiceTake>) => void;
}

export const VoiceMemoView: React.FC<VoiceMemoViewProps> = ({ takes, onUpdateTake }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleTogglePlay = (take: VoiceTake) => {
    if (!audioRef.current) return;

    if (playingId === take.id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      if (take.audioUrl) {
        try {
          audioRef.current.src = take.audioUrl;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setPlayingId(take.id);
            }).catch(e => {
              console.error("Playback error", e);
              setPlayingId(null);
            });
          }
        } catch (err) {
          console.error("Audio initialization error", err);
        }
      }
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const transcribeAudio = async (take: VoiceTake) => {
    if (!take.audioUrl) return;
    
    setTranscribingIds(prev => new Set(prev).add(take.id));
    
    try {
      const response = await fetch(take.audioUrl);
      const blob = await response.blob();
      const base64Data = await blobToBase64(blob);

      // Using gemini-3-flash-preview as per standard guidelines for multimodal tasks
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const genResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { data: base64Data, mimeType: blob.type || 'audio/mp3' } },
              { text: "Please transcribe this audio recording accurately. Provide only the text transcription." }
            ]
          }
        ]
      });

      const text = genResponse.text || "Could not transcribe audio.";
      onUpdateTake(take.id, { transcription: text.trim() });
    } catch (error) {
      console.error("Transcription failed", error);
      onUpdateTake(take.id, { transcription: "Error: Could not reach AI service. Please try again." });
    } finally {
      setTranscribingIds(prev => {
        const next = new Set(prev);
        next.delete(take.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {takes.length === 0 && (
         <div className="py-20 text-center text-[var(--text-tertiary)] text-xs mono border border-dashed border-[var(--border-main)] rounded-lg">
           NO RECORDINGS YET
         </div>
      )}
      
      {takes.map((take) => {
        const isPlaying = playingId === take.id;
        const isTranscribing = transcribingIds.has(take.id);
        
        return (
          <div key={take.id} className={`bg-[var(--bg-card)] border ${isPlaying ? 'border-[var(--accent)]' : 'border-[var(--border-main)]'} rounded-lg p-4 flex flex-col gap-3 transition-all hover:bg-[var(--bg-hover)] group`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleTogglePlay(take)}
                disabled={!take.audioUrl}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-[var(--text-main)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] disabled:opacity-50'}`}
              >
                {isPlaying ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" className="ml-1" />
                )}
              </button>
              
              <div className="flex-1 flex flex-col min-w-0">
                 <div className="flex items-center gap-3 mb-1">
                   <span className="text-sm font-medium text-[var(--text-main)] truncate">Take {take.id}</span>
                   <span className="text-[10px] mono text-[var(--text-tertiary)] tabular-nums uppercase">{take.duration}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] mono text-[var(--text-tertiary)] uppercase">{take.timestamp}</span>
                 </div>
              </div>

              <div className="flex items-center gap-1">
                 <button 
                   onClick={() => transcribeAudio(take)}
                   disabled={isTranscribing}
                   className={`p-2 rounded-md transition-all ${isTranscribing ? 'animate-pulse text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-secondary)]'}`}
                   title="AI Transcribe"
                 >
                   {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                 </button>

                 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                    {take.audioUrl && (
                      <a 
                        href={take.audioUrl} 
                        download={`take-${take.id}.mp3`}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>
                    )}
                    <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                 </div>
              </div>
            </div>

            {(take.transcription || isTranscribing) && (
              <div className="mt-2 pt-3 border-t border-[var(--border-main)] animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-2 mb-2 text-[9px] mono uppercase text-[var(--text-tertiary)] tracking-widest">
                  <Edit3 size={10} />
                  <span>Transcription</span>
                </div>
                <textarea
                  value={take.transcription}
                  onChange={(e) => onUpdateTake(take.id, { transcription: e.target.value })}
                  placeholder={isTranscribing ? "Processing audio..." : "Empty transcription"}
                  disabled={isTranscribing}
                  className="w-full bg-[var(--bg-secondary)] text-[var(--text-main)] text-xs leading-relaxed font-sans p-3 rounded-md focus:outline-none border border-transparent focus:border-[var(--border-focus)] resize-none scrollbar-hide min-h-[60px]"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};