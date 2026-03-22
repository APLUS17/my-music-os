
import React from 'react';
import { X, Zap, Waves, Activity, Power } from 'lucide-react';

export interface FXSettings {
  space: number;
  echo: number;
  punch: number;
}

interface FXPanelProps {
  onClose: () => void;
  settings: FXSettings;
  onUpdate: (key: keyof FXSettings, value: number) => void;
}

export const FXPanel: React.FC<FXPanelProps> = ({ onClose, settings, onUpdate }) => {
  return (
    <div className="absolute inset-0 bg-[var(--bg-card)] z-50 flex flex-col p-6 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-main)] border border-[var(--border-main)]">
             <Activity size={16} />
          </div>
          <h2 className="text-lg font-medium tracking-tight text-[var(--text-main)]">Vocal FX</h2>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* FX Controls */}
      <div className="flex-1 space-y-8">
        
        {/* Space (Reverb) */}
        <div className="space-y-3 group">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-main)]">
                 <Waves size={16} className="text-[var(--accent)]" />
                 <span className="text-xs mono uppercase tracking-wide font-medium">Space</span>
              </div>
              <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.space}%</span>
           </div>
           <input 
             type="range" 
             min="0" 
             max="100" 
             value={settings.space}
             onChange={(e) => onUpdate('space', parseInt(e.target.value))}
             className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
           />
        </div>

        {/* Echo (Delay) */}
        <div className="space-y-3 group">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-main)]">
                 <Zap size={16} className="text-[var(--accent)]" />
                 <span className="text-xs mono uppercase tracking-wide font-medium">Echo</span>
              </div>
              <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.echo}%</span>
           </div>
           <input 
             type="range" 
             min="0" 
             max="100" 
             value={settings.echo}
             onChange={(e) => onUpdate('echo', parseInt(e.target.value))}
             className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
           />
        </div>

        {/* Punch (Compression) */}
        <div className="space-y-3 group">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-main)]">
                 <Power size={16} className="text-[var(--accent)]" />
                 <span className="text-xs mono uppercase tracking-wide font-medium">Punch</span>
              </div>
              <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.punch}%</span>
           </div>
           <input 
             type="range" 
             min="0" 
             max="100" 
             value={settings.punch}
             onChange={(e) => onUpdate('punch', parseInt(e.target.value))}
             className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
           />
        </div>

      </div>
      
      {/* Footer Indicator */}
      <div className="border-t border-[var(--border-main)] pt-6 flex justify-center">
         <p className="text-xs text-[var(--text-tertiary)] mono uppercase">Processing Chain Active</p>
      </div>
    </div>
  );
};
