import React, { useState, useRef, useEffect } from 'react';

interface WaveformProps {
  progress: number; // 0 to 1
  onScrub: (newProgress: number) => void;
}

export const Waveform: React.FC<WaveformProps> = ({ progress, onScrub }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const barCount = 45; 
  const bars = React.useMemo(() => {
    return Array.from({ length: barCount }).map(() => Math.random() * 24 + 10);
  }, []);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const relativeX = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    onScrub(relativeX);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleInteraction(e);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onScrub(relativeX);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, onScrub]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-16 flex items-center justify-center cursor-pointer select-none group"
      onMouseDown={onMouseDown}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleInteraction(e);
      }}
    >
      <div className="flex items-center gap-[2.5px] w-full justify-center">
        {bars.map((height, i) => {
          const barProgress = i / barCount;
          const isPlayed = barProgress < progress;
          return (
            <div 
              key={i}
              style={{ 
                height: `${height}px`,
                backgroundColor: isPlayed ? 'var(--accent)' : 'var(--bg-secondary)',
                transition: 'background-color 0.2s ease, height 0.3s ease'
              }}
              className="w-[3px] rounded-full opacity-80 group-hover:opacity-100"
            />
          );
        })}
      </div>
      
      {/* Playhead */}
      <div 
        className="absolute top-0 bottom-0 w-[2.5px] bg-[var(--text-main)] rounded-full z-10 pointer-events-none"
        style={{ 
          left: `${progress * 100}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 10px var(--accent-dim)'
        }}
      >
        <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--text-main)] shadow-lg" />
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--text-main)] shadow-lg" />
      </div>
    </div>
  );
};