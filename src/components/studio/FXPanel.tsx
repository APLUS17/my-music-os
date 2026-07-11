import React from 'react';
import { X, Zap, Waves, Activity, Power, Sliders } from 'lucide-react';

export interface FXSettings {
  space: number;
  echo: number;
  punch: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export const defaultFXSettings: FXSettings = {
  space: 0,
  echo: 0,
  punch: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
};

interface FXPanelProps {
  onClose: () => void;
  settings: FXSettings;
  onUpdate: (key: keyof FXSettings, value: number) => void;
  isRecordingMode?: boolean;
  isFXActive?: boolean;
  onFXActiveToggle?: (active: boolean) => void;
  isMonitoringEnabled?: boolean;
  onMonitoringToggle?: (enabled: boolean) => void;
}

export const FXPanel: React.FC<FXPanelProps> = ({ 
  onClose, 
  settings, 
  onUpdate,
  isRecordingMode = false,
  isFXActive = false,
  onFXActiveToggle,
  isMonitoringEnabled = false,
  onMonitoringToggle
}) => {
  return (
    <div className="absolute inset-0 bg-[var(--bg-card)] z-50 flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
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

      {/* Recording Mode Toggles */}
      {isRecordingMode && (
        <div className="mb-6 space-y-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-main)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-main)]">Vocal FX Processing</span>
              <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">Toggle real-time vocal effects</span>
            </div>
            <button
              onClick={() => onFXActiveToggle?.(!isFXActive)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none ${isFXActive ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-[var(--bg-card)] border border-[var(--border-main)]'}`}
              aria-label="Toggle Vocal FX"
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isFXActive ? 'translate-x-5' : 'translate-x-0'}`} 
              />
            </button>
          </div>
          <div className="h-[1px] bg-[var(--border-main)] w-full" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-main)]">Live Monitoring</span>
              <span className="text-[10px] text-red-400 font-medium mt-0.5">Use headphones to prevent feedback</span>
            </div>
            <button
              onClick={() => onMonitoringToggle?.(!isMonitoringEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none ${isMonitoringEnabled ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-[var(--bg-card)] border border-[var(--border-main)]'}`}
              aria-label="Toggle Live Monitoring"
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isMonitoringEnabled ? 'translate-x-5' : 'translate-x-0'}`} 
              />
            </button>
          </div>
        </div>
      )}

      {/* FX Controls */}
      <div className="flex-1 space-y-8 pb-10">
        
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

        {/* 3-Band EQ */}
        <div className="pt-4 border-t border-[var(--border-main)] space-y-6">
            <div className="flex items-center gap-2 text-[var(--text-main)]">
                <Sliders size={16} className="text-[var(--accent)]" />
                <span className="text-xs mono uppercase tracking-wide font-medium">Equalizer</span>
            </div>

            {/* Low */}
            <div className="space-y-3 group">
              <div className="flex items-center justify-between">
                  <span className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)]">Low</span>
                  <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.eqLow > 0 ? '+' : ''}{settings.eqLow} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={settings.eqLow}
                onChange={(e) => onUpdate('eqLow', parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
              />
            </div>

            {/* Mid */}
            <div className="space-y-3 group">
              <div className="flex items-center justify-between">
                  <span className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)]">Mid</span>
                  <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.eqMid > 0 ? '+' : ''}{settings.eqMid} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={settings.eqMid}
                onChange={(e) => onUpdate('eqMid', parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
              />
            </div>

            {/* High */}
            <div className="space-y-3 group">
              <div className="flex items-center justify-between">
                  <span className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)]">High</span>
                  <span className="text-xs mono tabular-nums text-[var(--text-tertiary)]">{settings.eqHigh > 0 ? '+' : ''}{settings.eqHigh} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={settings.eqHigh}
                onChange={(e) => onUpdate('eqHigh', parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--accent-dim)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
              />
            </div>
        </div>

      </div>
      
      {/* Footer Indicator */}
      <div className="border-t border-[var(--border-main)] pt-6 flex justify-center shrink-0">
         <p className="text-xs text-[var(--text-tertiary)] mono uppercase">Processing Chain Active</p>
      </div>
    </div>
  );
};
