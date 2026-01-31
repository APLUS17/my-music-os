import React, { useState, useRef, useEffect } from 'react';
import { Waveform } from './Waveform';
import { 
  Undo2, 
  Play, 
  Pause,
  Mic,
  Square,
  Save,
  Trash2,
  Upload
} from 'lucide-react';

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number) => void;
}

export const RecorderDrawer: React.FC<RecorderDrawerProps> = ({ onClose, onSave }) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        
        if (audioRef.current) {
           const url = URL.createObjectURL(blob);
           audioRef.current.src = url;
           audioRef.current.onended = () => {
             setIsPlaying(false);
             setProgress(1);
           };
           audioRef.current.ontimeupdate = () => {
             if (audioRef.current && duration > 0) {
               setProgress(audioRef.current.currentTime / duration);
             }
           };
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setProgress(0);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (recordedBlob && !confirm("Discard recording?")) return;
      startRecording();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        setDuration(tempAudio.duration);
        setRecordedBlob(file);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.ontimeupdate = () => {
            if (audioRef.current && tempAudio.duration > 0) {
              setProgress(audioRef.current.currentTime / tempAudio.duration);
            }
          };
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setProgress(1);
          };
        }
      };
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob, duration);
      onClose();
    }
  };

  const handleScrub = (val: number) => {
    if (audioRef.current && recordedBlob) {
      audioRef.current.currentTime = val * duration;
      setProgress(val);
    }
  };

  return (
    <div className="w-full bg-[var(--bg-card)] rounded-t-xl border-t border-[var(--border-main)] p-6 pb-12 text-[var(--text-main)] shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center">
      <audio ref={audioRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleImportFile} />

      <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-[var(--border-main)]">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[var(--text-tertiary)]'}`} />
           <span className="text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">
             {isRecording ? 'RECORDING' : recordedBlob ? 'REVIEW' : 'READY'}
           </span>
        </div>
        <span className="text-xl font-medium tabular-nums tracking-tight font-mono">{formatTime(duration)}</span>
        <button onClick={onClose} className="text-[10px] mono uppercase text-[var(--text-secondary)]">Close</button>
      </div>

      <div className="w-full mb-10">
        <Waveform progress={progress} onScrub={handleScrub} />
      </div>

      <div className="flex items-center gap-12 mb-10">
        <button disabled={isRecording} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30" onClick={() => fileInputRef.current?.click()}>
          <Upload size={20} strokeWidth={1.5} />
        </button>
        <button onClick={handleToggleRecord} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border ${isRecording ? 'border-red-900 bg-red-500/10 text-red-500' : 'border-[var(--border-main)] bg-[var(--bg-secondary)] text-[var(--text-main)] hover:scale-105'}`}>
          {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={24} strokeWidth={1.5} />}
        </button>
        <button disabled={!recordedBlob || isRecording} onClick={() => setIsPlaying(!isPlaying)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30">
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
      </div>

      <div className="w-full flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 border border-[var(--border-main)] rounded-md text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)]">Discard</button>
        <button onClick={handleSave} disabled={!recordedBlob} className="flex-1 py-3 bg-[var(--text-main)] text-[var(--bg-main)] rounded-md text-[10px] mono uppercase tracking-widest disabled:opacity-50">Keep Take</button>
      </div>
    </div>
  );
};