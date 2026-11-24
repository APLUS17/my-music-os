import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface LyriqVaultTrack {
  id: string;
  title: string;
  subtitle?: string;       // e.g. lyric hook or Japanese translation
  dateLabel: string;       // e.g. "NOV 21, 2026"
  timestamp: number;       // Unix ms for timeline sorting/scrubbing
  bpm?: number;
  musicalKey?: string;     // e.g. "F MIN"
  kind?: 'SONG' | 'BEAT';
  accentHex?: string;      // Optional custom sleeve accent (defaults to cobalt/vermilion/ink)
}

export interface LyriqCurvedVaultProps {
  tracks: LyriqVaultTrack[];
  initialTrackId?: string;
  onOpenTrack: (track: LyriqVaultTrack) => void;
  onCreateNew?: () => void;
  onClose?: () => void;
}

const DEFAULT_ACCENTS = ['#1F3FB0', '#C83E2B', '#141414', '#2B5B4E'];

const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

function formatMeta(tr: LyriqVaultTrack): string {
  return [tr.dateLabel, tr.musicalKey, tr.bpm ? `${tr.bpm} BPM` : null]
    .filter(Boolean)
    .join(' — ');
}

function formatSub(tr: LyriqVaultTrack): string {
  return tr.subtitle || `${tr.kind || 'SESSION'} // ZERO POST-PRODUCTION`;
}

export const LyriqCurvedVault: React.FC<LyriqCurvedVaultProps> = ({
  tracks,
  initialTrackId,
  onOpenTrack,
  onCreateNew,
  onClose,
}) => {
  // Sort chronologically for the bottom timeline ruler
  const sortedTracks = useMemo(() => {
    if (!tracks.length) return [];
    return [...tracks].sort((a, b) => a.timestamp - b.timestamp);
  }, [tracks]);

  // Repeat catalog so the curved shelf wraps infinitely without gaps or seam jumps
  const { virtualItems, repeats } = useMemo(() => {
    const c = sortedTracks.length;
    if (c === 0) return { virtualItems: [] as Array<{ v: number; track: LyriqVaultTrack }>, repeats: 3 };
    const r = Math.max(3, Math.ceil(36 / c));
    const total = c * r;
    return {
      repeats: r,
      virtualItems: Array.from({ length: total }, (_, v) => ({
        v,
        track: sortedTracks[v % c],
      })),
    };
  }, [sortedTracks]);

  const count = sortedTracks.length || 1;
  const initialIdx = useMemo(() => {
    if (!sortedTracks.length) return 0;
    if (initialTrackId) {
      const found = sortedTracks.findIndex((t) => t.id === initialTrackId);
      if (found >= 0) return found;
    }
    return Math.floor(sortedTracks.length / 2);
  }, [sortedTracks, initialTrackId]);

  const startV = Math.floor(repeats / 2) * count + initialIdx;

  const [activeIndex, setActiveIndex] = useState(initialIdx);

  // Refs for zero-rerender 60/120fps physics loop
  const probeRef = useRef<HTMLDivElement>(null);
  const tapeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const liftRefs = useRef<number[]>([]);
  const hoveredVRef = useRef<number | null>(null);
  const playRingRef = useRef<HTMLButtonElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Caption mask refs for Web Animations API slide (managed imperatively so React never conflicts with WAAPI nodes)
  const titleMaskRef = useRef<HTMLDivElement>(null);
  const subMaskRef = useRef<HTMLDivElement>(null);
  const metaMaskRef = useRef<HTMLDivElement>(null);

  // Physics state refs
  const sRef = useRef(startV);
  const tRef = useRef(startV);
  const activeIdxRef = useRef(initialIdx);
  const dotRatioRef = useRef(0.5);

  const mouseRef = useRef({ x: -999, y: -999, cx: -999, cy: -999 });
  const tiltRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startT: 0, moved: false, lastDragAt: 0 });
  const scrubbingTimelineRef = useRef(false);

  // Time bounds for the bottom scrubber
  const timeBounds = useMemo(() => {
    if (sortedTracks.length <= 1) {
      const now = Date.now();
      return { min: now - 86400000 * 30, max: now };
    }
    const min = sortedTracks[0].timestamp;
    const max = sortedTracks[sortedTracks.length - 1].timestamp;
    return { min, max: max === min ? min + 86400000 : max };
  }, [sortedTracks]);

  const getTrackRatio = useCallback(
    (idx: number) => {
      if (sortedTracks.length <= 1) return 0.5;
      const t = sortedTracks[idx]?.timestamp ?? timeBounds.min;
      return Math.max(0, Math.min(1, (t - timeBounds.min) / (timeBounds.max - timeBounds.min)));
    },
    [sortedTracks, timeBounds]
  );

  // Set static initial caption text inside WAAPI mask containers
  const setStaticMaskText = useCallback(
    (container: HTMLDivElement | null, text: string, className: string) => {
      if (!container) return;
      container.innerHTML = '';
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      span.style.gridArea = '1 / 1';
      container.appendChild(span);
    },
    []
  );

  // Trigger Web Animations API mask slide when active song changes
  const animateMaskText = useCallback(
    (container: HTMLDivElement | null, nextText: string, dir: number, className: string) => {
      if (!container) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const existing = Array.from(container.children) as HTMLElement[];

      const span = document.createElement('span');
      span.className = className;
      span.textContent = nextText;
      span.style.gridArea = '1 / 1';
      container.appendChild(span);

      if (reduced) {
        existing.forEach((el) => el.remove());
        return;
      }

      const d = dir === 0 ? 1 : dir;
      span.animate(
        [
          { transform: `translateY(${d * 105}%)` },
          { transform: 'translateY(0%)' },
        ],
        { duration: 620, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
      );

      existing.forEach((oldEl) => {
        const computed = getComputedStyle(oldEl).transform;
        const anim = oldEl.animate(
          [
            { transform: computed === 'none' ? 'translateY(0%)' : computed },
            { transform: `translateY(${-d * 105}%)` },
          ],
          { duration: 620, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
        );
        anim.onfinish = () => oldEl.remove();
      });
    },
    []
  );

  // Sync physics refs & initial caption whenever the track list mounts or changes
  useEffect(() => {
    if (!sortedTracks.length) return;
    sRef.current = startV;
    tRef.current = startV;
    activeIdxRef.current = initialIdx;
    setActiveIndex(initialIdx);
    dotRatioRef.current = getTrackRatio(initialIdx);

    const tr = sortedTracks[initialIdx];
    if (tr) {
      setStaticMaskText(titleMaskRef.current, tr.title, 'lyriq-cap-title');
      setStaticMaskText(subMaskRef.current, formatSub(tr), 'lyriq-cap-sub');
      setStaticMaskText(metaMaskRef.current, formatMeta(tr), 'lyriq-cap-meta');
    }
  }, [sortedTracks, startV, initialIdx, getTrackRatio, setStaticMaskText]);

  // Main requestAnimationFrame loop
  useEffect(() => {
    if (!sortedTracks.length) return;

    let rafId = 0;
    let lastTime = performance.now();
    const totalV = virtualItems.length;
    liftRefs.current = new Array(totalV).fill(0);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const W = window.innerWidth;
      const H = probeRef.current?.clientHeight || Math.min(window.innerHeight * 0.47, W * 0.33);
      const cyPx = window.innerHeight * (W < 768 ? 0.43 : 0.41);

      const ws = (H * 142) / 840;
      const d = (H * 474) / 900;
      const gap = H * 0.035;
      const U = W < 768 ? H * 1.05 : H * 1.3;
      const P = 1400;

      // Build screen-X integral lookup table
      const steps = Math.ceil((3 * U) / 2) + 2;
      const XS = new Float32Array(steps);
      for (let i = 1; i < steps; i++) {
        const u = i * 2;
        XS[i] = XS[i - 1] + 2 / (1 + Math.pow(u / U, 1.6));
      }

      const xsc = (u: number) => {
        const absU = Math.abs(u);
        const idx = Math.min(steps - 2, Math.floor(absU / 2));
        const frac = absU / 2 - idx;
        const val = XS[idx] + (XS[idx + 1] - XS[idx]) * frac;
        return Math.sign(u) * val;
      };

      // 1. Spring physics
      const kSpring = dragRef.current.active ? 18 : 5.2;
      sRef.current += (tRef.current - sRef.current) * (1 - Math.exp(-kSpring * dt));

      // Keep s & T bounded near center copy
      if (Math.abs(sRef.current - startV) > count * 2) {
        const shift = Math.round((sRef.current - startV) / count) * count;
        sRef.current -= shift;
        tRef.current -= shift;
      }

      // 2. Active track change detection
      const nearestV = Math.round(sRef.current);
      const nextIdx = ((nearestV % count) + count) % count;
      if (nextIdx !== activeIdxRef.current) {
        const dir = Math.sign(tRef.current - sRef.current) || 1;
        activeIdxRef.current = nextIdx;
        setActiveIndex(nextIdx);
        const tr = sortedTracks[nextIdx];
        if (tr) {
          animateMaskText(titleMaskRef.current, tr.title, dir, 'lyriq-cap-title');
          animateMaskText(subMaskRef.current, formatSub(tr), dir, 'lyriq-cap-sub');
          animateMaskText(metaMaskRef.current, formatMeta(tr), dir, 'lyriq-cap-meta');
        }
      }

      // 3. Cover pointer tilt
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const settled = Math.abs(tRef.current - sRef.current) < 0.3;
      const onCover =
        settled &&
        Math.abs(mx - W / 2) < 0.55 * d &&
        Math.abs(my - cyPx) < 0.55 * H;

      const targetTiltY = onCover
        ? ((mx - W / 2) / (0.55 * d)) * 8
        : mx > 0
        ? ((mx - W / 2) / W) * 4
        : 0;
      const targetTiltX = onCover ? -((my - cyPx) / (H / 2)) * 5 : 0;

      tiltRef.current.x += (targetTiltX - tiltRef.current.x) * (1 - Math.exp(-7 * dt));
      tiltRef.current.y += (targetTiltY - tiltRef.current.y) * (1 - Math.exp(-7 * dt));

      // 4. Update every 3D sleeve transform
      for (let v = 0; v < totalV; v++) {
        const el = tapeRefs.current[v];
        if (!el) continue;

        let r = (((v - sRef.current) % totalV) + totalV) % totalV;
        if (r >= totalV / 2) r -= totalV;

        const B = Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5;
        const u = r * (ws + gap) + (d - ws + 1.4 * gap) * B;

        if (Math.abs(u) > U * 1.95) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';

        const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
        const sc = 1 / (1 + Math.pow(Math.abs(u) / U, 1.6));
        const invSc = 1 / sc;

        const targetLift = hoveredVRef.current === v && Math.abs(r) > 0.5 ? 1 : 0;
        liftRefs.current[v] += (targetLift - liftRefs.current[v]) * (1 - Math.exp(-12 * dt));
        const lift = liftRefs.current[v];

        const z = P * (1 - invSc) + o * H * 0.1;
        const x = xsc(u) * invSc;
        const y = (H * 0.5 * (1 - sc) * 0.42 + o * H * 0.012 - lift * H * 0.05) * invSc;
        const rotY =
          Math.sign(u) * Math.min(1, Math.abs(u) / U) * 26 * (1 - o) -
          90 * o +
          tiltRef.current.y * o;
        const rotX = tiltRef.current.x * o;

        el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        el.style.zIndex = String(Math.round(3000 + z));

        const spShade = Math.min(0.6, o * 0.55 + (1 - sc) * 0.32);
        const cvShade = (1 - o) * 0.82;
        el.style.setProperty('--sp-shade', spShade.toFixed(3));
        el.style.setProperty('--cv-shade', cvShade.toFixed(3));
        el.style.setProperty('--ws', `${ws}px`);
        el.style.setProperty('--d', `${d}px`);
      }

      // 5. Play ring positioning & scale
      if (playRingRef.current) {
        const ringScale = smoothstep(Math.max(0, 1 - Math.abs(tRef.current - sRef.current) * 3));
        playRingRef.current.style.left = `${W / 2 - d / 2 - 6}px`;
        playRingRef.current.style.top = `${cyPx + 0.36 * H}px`;
        playRingRef.current.style.transform = `scale(${ringScale})`;
      }

      // 6. Timeline dot glide
      const targetRatio = getTrackRatio(nextIdx);
      dotRatioRef.current += (targetRatio - dotRatioRef.current) * (1 - Math.exp(-14 * dt));
      if (dotRef.current) {
        dotRef.current.style.left = `${dotRatioRef.current * 100}%`;
      }

      // 7. Custom cursor smoothing
      if (cursorRef.current && mouseRef.current.x > 0) {
        mouseRef.current.cx += (mouseRef.current.x - mouseRef.current.cx) * (1 - Math.exp(-16 * dt));
        mouseRef.current.cy += (mouseRef.current.y - mouseRef.current.cy) * (1 - Math.exp(-16 * dt));
        cursorRef.current.style.transform = `translate3d(${mouseRef.current.cx - 29}px, ${
          mouseRef.current.cy - 29
        }px, 0)`;
        cursorRef.current.classList.toggle('is-open', onCover);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [sortedTracks, virtualItems, count, startV, getTrackRatio, animateMaskText]);

  // Wheel & Keyboard listeners
  useEffect(() => {
    let snapTimer: number | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      tRef.current += delta * 0.004;
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        tRef.current = Math.round(tRef.current);
      }, 160);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') tRef.current = Math.round(tRef.current) + 1;
      if (e.key === 'ArrowLeft') tRef.current = Math.round(tRef.current) - 1;
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && sortedTracks[activeIdxRef.current]) {
        onOpenTrack(sortedTracks[activeIdxRef.current]);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(snapTimer);
    };
  }, [sortedTracks, onOpenTrack, onClose]);

  const jumpToTimelineClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el || !sortedTracks.length) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTs = timeBounds.min + ratio * (timeBounds.max - timeBounds.min);

      let closestIdx = 0;
      let bestDiff = Infinity;
      sortedTracks.forEach((tr, i) => {
        const diff = Math.abs(tr.timestamp - targetTs);
        if (diff < bestDiff) {
          bestDiff = diff;
          closestIdx = i;
        }
      });

      const currentMod = ((Math.round(tRef.current) % count) + count) % count;
      let delta = closestIdx - currentMod;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      tRef.current = Math.round(tRef.current) + delta;
    },
    [sortedTracks, timeBounds, count]
  );

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('.lyriq-timeline') || target?.closest('.lyriq-topbar')) {
      return;
    }
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startT: tRef.current,
      moved: false,
      lastDragAt: dragRef.current.lastDragAt,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mouseRef.current.cx < -500) {
      mouseRef.current.cx = e.clientX;
      mouseRef.current.cy = e.clientY;
    }
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
    if (scrubbingTimelineRef.current) {
      jumpToTimelineClientX(e.clientX);
      return;
    }
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 5) dragRef.current.moved = true;
    if (dragRef.current.moved) {
      tRef.current = dragRef.current.startT - dx * 0.012;
    }
  };

  const handlePointerUp = () => {
    scrubbingTimelineRef.current = false;
    if (dragRef.current.moved) {
      tRef.current = Math.round(tRef.current);
      dragRef.current.lastDragAt = performance.now();
    }
    dragRef.current.active = false;
  };

  const handleTapeClick = (v: number, track: LyriqVaultTrack) => {
    if (performance.now() - dragRef.current.lastDragAt < 60) return;
    const totalV = virtualItems.length;
    let r = (((v - sRef.current) % totalV) + totalV) % totalV;
    if (r >= totalV / 2) r -= totalV;

    if (Math.abs(r) < 0.45) {
      tRef.current = Math.round(tRef.current);
      onOpenTrack(track);
    } else {
      tRef.current = Math.round(tRef.current + r);
    }
  };

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    scrubbingTimelineRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    jumpToTimelineClientX(e.clientX);
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingTimelineRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const activeTrack = sortedTracks[activeIndex] || sortedTracks[0];

  return (
    <div
      className="lyriq-vault-root"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <style>{VAULT_CSS}</style>

      {/* Hidden height probe */}
      <div ref={probeRef} className="lyriq-height-probe" />

      {/* Multiply paper grain overlay */}
      <div className="lyriq-paper-grain" aria-hidden="true" />

      {/* Top Bar */}
      <header className="lyriq-topbar">
        <div
          className="lyriq-brand"
          onClick={() => (tRef.current = startV)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') tRef.current = startV;
          }}
        >
          <span className="lyriq-lbl">LYRIQ</span>
          <span className="lyriq-brand-line" />
          <span className="lyriq-lbl">SONG VAULT</span>
        </div>

        <nav className="lyriq-nav">
          <span className="lyriq-lbl">{sortedTracks.length} SESSIONS</span>
          {onCreateNew && (
            <button
              type="button"
              className="lyriq-box lyriq-lbl"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNew();
              }}
            >
              + NEW CAPTURE
            </button>
          )}
        </nav>
      </header>

      {/* Giant Halftone Kanji Backdrop */}
      <div className="lyriq-kanji lyriq-kanji-left" aria-hidden="true">
        音楽
      </div>
      <div className="lyriq-kanji lyriq-kanji-right" aria-hidden="true">
        の記憶
      </div>

      {/* Floor Shadow */}
      <div className="lyriq-floor-shadow" aria-hidden="true" />

      {/* 3D Curved Shelf */}
      <section className="lyriq-shelf" aria-label="Song Archive Shelf">
        <div className="lyriq-stage">
          {virtualItems.map(({ v, track }) => {
            const accent =
              track.accentHex || DEFAULT_ACCENTS[v % DEFAULT_ACCENTS.length];
            const indexNum = String((v % count) + 1).padStart(2, '0');

            return (
              <div
                key={v}
                ref={(el) => {
                  tapeRefs.current[v] = el;
                }}
                className="lyriq-tape"
                onMouseEnter={() => (hoveredVRef.current = v)}
                onMouseLeave={() => {
                  if (hoveredVRef.current === v) hoveredVRef.current = null;
                }}
                onClick={() => handleTapeClick(v, track)}
              >
                {/* SPINE FACE (Custom Minimalist Studio Cassette/VHS Spine) */}
                <div className="lyriq-face lyriq-sp">
                  <div className="lyriq-sp-top-bar" style={{ backgroundColor: accent }} />
                  <span className="lyriq-sp-num">{indexNum}</span>
                  <span className="lyriq-sp-title">{track.title}</span>
                  <div className="lyriq-sp-footer">
                    <span className="lyriq-sp-tag">{track.kind || 'SONG'}</span>
                    <span className="lyriq-sp-badge">LYRIQ</span>
                  </div>
                </div>

                {/* FRONT COVER FACE (Custom Typographic & Geometric Studio Sleeve) */}
                <div className="lyriq-face lyriq-cv">
                  <div className="lyriq-cv-header">
                    <span>SOUNDBYAYO // {track.kind || 'SESSION'}</span>
                    <span>NO. {indexNum}</span>
                  </div>

                  <div className="lyriq-cv-title-block">
                    <div className="lyriq-cv-title">{track.title}</div>
                    {track.subtitle && (
                      <div className="lyriq-cv-sub">{track.subtitle}</div>
                    )}
                  </div>

                  {/* Minimalist geometric vinyl/tape reel graphic */}
                  <div className="lyriq-cv-art" style={{ borderColor: accent }}>
                    <div
                      className="lyriq-cv-disc"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, #ECE8E0 0 18%, ${accent} 19% 46%, #141414 47% 100%)`,
                      }}
                    />
                    <div className="lyriq-cv-specs">
                      <span>{track.musicalKey || 'RAW TAKE'}</span>
                      <span>{track.bpm ? `${track.bpm} BPM` : 'UNQUANTIZED'}</span>
                    </div>
                  </div>

                  <div className="lyriq-cv-footer">
                    <span>{track.dateLabel}</span>
                    <span className="lyriq-cv-stamp">ZERO POST-PROD</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Cover Play Ring */}
      {activeTrack && (
        <button
          ref={playRingRef}
          type="button"
          className="lyriq-play-ring"
          aria-label={`Open ${activeTrack.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenTrack(activeTrack);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="#1F3FB0">
            <polygon points="2,1 11,6 2,11" />
          </svg>
        </button>
      )}

      {/* Active Track Caption & Navigation Arrows */}
      {activeTrack && (
        <div className="lyriq-caption">
          <button
            type="button"
            className="lyriq-arrow lyriq-arrow-prev"
            aria-label="Previous session"
            onClick={(e) => {
              e.stopPropagation();
              tRef.current = Math.round(tRef.current) - 1;
            }}
          >
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M6 1L1 6l5 5M1 6h23" />
            </svg>
          </button>

          <div ref={titleMaskRef} className="lyriq-cap-mask" aria-live="polite" />

          <button
            type="button"
            className="lyriq-arrow lyriq-arrow-next"
            aria-label="Next session"
            onClick={(e) => {
              e.stopPropagation();
              tRef.current = Math.round(tRef.current) + 1;
            }}
          >
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M18 1l5 5-5 5M23 6H0" />
            </svg>
          </button>

          <div ref={subMaskRef} className="lyriq-cap-mask" />

          <div className="lyriq-cap-rule" />

          <div ref={metaMaskRef} className="lyriq-cap-mask" />
        </div>
      )}

      {/* Chronological Timeline Scrubber */}
      <div
        ref={timelineRef}
        className="lyriq-timeline"
        onPointerDown={handleTimelinePointerDown}
        onPointerUp={handleTimelinePointerUp}
        onPointerCancel={handleTimelinePointerUp}
      >
        <div className="lyriq-timeline-line" />
        <div className="lyriq-timeline-ticks">
          {Array.from({ length: 36 }, (_, i) => (
            <span
              key={i}
              className={`lyriq-tick ${i % 6 === 0 || i === 35 ? 'is-major' : ''}`}
            />
          ))}
        </div>
        <div ref={dotRef} className="lyriq-timeline-dot" />
        <div className="lyriq-timeline-labels">
          <span>EARLIEST</span>
          <span>CHRONOLOGICAL VAULT</span>
          <span>LATEST</span>
        </div>
      </div>

      {/* Custom Pointer Cursor (Desktop) */}
      <div ref={cursorRef} className="lyriq-cursor" aria-hidden="true">
        <div className="lyriq-cursor-ring" />
        <div className="lyriq-cursor-dot" />
        <span className="lyriq-cursor-label">
          OPEN
          <br />
          開く
        </span>
      </div>
    </div>
  );
};

const VAULT_CSS = `
.lyriq-vault-root {
  --paper: #ECE8E0;
  --sheet: #F3F0EA;
  --ink: #141414;
  --muted: #6D6A63;
  --cobalt: #1F3FB0;
  --rule: rgba(20, 20, 20, 0.85);
  --H: min(47vh, 33vw);
  --cy: 41%;

  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: "Inter Tight", "Noto Sans JP", system-ui, sans-serif;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

@media (pointer: fine) {
  .lyriq-vault-root, .lyriq-vault-root button { cursor: none; }
}

@media (max-width: 767px) {
  .lyriq-vault-root {
    --H: min(68vw, 40svh);
    --cy: 43%;
  }
}

.lyriq-height-probe {
  position: fixed;
  height: var(--H);
  width: 0;
  pointer-events: none;
  visibility: hidden;
}

.lyriq-paper-grain {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.55;
  background-size: 220px 220px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.42 0 0 0 0 0.38 0 0 0 0.22 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");
}

.lyriq-lbl {
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.lyriq-box {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--cobalt);
  background: transparent;
  color: var(--cobalt);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.lyriq-box:hover {
  background: var(--cobalt);
  color: var(--paper);
}

.lyriq-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 76px;
  padding: 0 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--cobalt);
  z-index: 30;
}

@media (max-width: 767px) {
  .lyriq-topbar {
    padding: 0 18px;
    height: 64px;
  }
}

.lyriq-brand, .lyriq-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

@media (max-width: 767px) {
  .lyriq-brand, .lyriq-nav {
    gap: 10px;
  }
}

.lyriq-brand-line {
  width: 40px;
  height: 1px;
  background: var(--cobalt);
}

@media (max-width: 767px) {
  .lyriq-brand-line {
    width: 20px;
  }
}

.lyriq-kanji {
  position: fixed;
  z-index: 1;
  pointer-events: none;
  writing-mode: vertical-rl;
  font-family: "Noto Sans JP", sans-serif;
  font-weight: 800;
  font-size: min(19vh, 12.5vw);
  line-height: 1.02;
  letter-spacing: 0.02em;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  background-image:
    radial-gradient(circle at 50% 50%, rgba(64, 82, 138, 0.55) 0 36%, transparent 40%),
    linear-gradient(rgba(110, 122, 160, 0.26), rgba(110, 122, 160, 0.26));
  background-size: 3px 3px, 100% 100%;
}

.lyriq-kanji-left { left: 2.4vw; top: 13vh; }
.lyriq-kanji-right { right: 2.4vw; top: 9vh; }

.lyriq-floor-shadow {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: calc(var(--cy) + var(--H) * 0.47);
  width: min(96vw, calc(var(--H) * 3.6));
  height: calc(var(--H) * 0.26);
  background: radial-gradient(50% 50% at 50% 40%, rgba(40, 32, 20, 0.30), rgba(40, 32, 20, 0.10) 55%, transparent 72%);
  pointer-events: none;
  z-index: 5;
}

.lyriq-shelf {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(var(--cy) - var(--H) / 2 - 50px);
  height: calc(var(--H) + 100px);
  perspective: 1400px;
  perspective-origin: 50% 50%;
  touch-action: pan-y;
  z-index: 10;
}

.lyriq-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.lyriq-tape {
  position: absolute;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.lyriq-face {
  position: absolute;
  height: var(--H);
  top: calc(var(--H) * -0.5);
  backface-visibility: hidden;
  border-radius: 2px;
  overflow: hidden;
  background: #F4F1EA;
  border: 1px solid rgba(20, 20, 20, 0.22);
  box-sizing: border-box;
}

.lyriq-face::after {
  content: "";
  position: absolute;
  inset: 0;
  background: #0b0a09;
  pointer-events: none;
}

/* Spine styling */
.lyriq-sp {
  width: var(--ws);
  left: calc(var(--ws) * -0.5);
  transform: translateZ(calc(var(--d) * 0.5));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 10px;
}

.lyriq-sp::after { opacity: var(--sp-shade, 0); }

.lyriq-sp-top-bar {
  width: 100%;
  height: 14px;
}

.lyriq-sp-num {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-top: 6px;
}

.lyriq-sp-title {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: clamp(10px, 1.35vh, 14px);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
  max-height: 56%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyriq-sp-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.lyriq-sp-tag {
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.lyriq-sp-badge {
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  padding: 2px 4px;
  border: 1px solid var(--ink);
  color: var(--ink);
}

/* Front cover styling */
.lyriq-cv {
  width: var(--d);
  left: calc(var(--d) * -0.5);
  transform: rotateY(90deg) translateZ(calc(var(--ws) * 0.5));
  box-shadow: 0 34px 60px -30px rgba(20, 16, 10, 0.55);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px;
  background: #F5F2EB;
}

.lyriq-cv::after { opacity: var(--cv-shade, 0); }

.lyriq-cv-header, .lyriq-cv-footer {
  display: flex;
  justify-content: space-between;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.lyriq-cv-title-block {
  margin-top: 6px;
}

.lyriq-cv-title {
  font-size: clamp(16px, 2.2vh, 24px);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lyriq-cv-sub {
  margin-top: 5px;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--cobalt);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lyriq-cv-art {
  flex: 1;
  margin: 12px 0;
  border-top: 1.5px solid;
  border-bottom: 1.5px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
}

.lyriq-cv-disc {
  width: 44%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.lyriq-cv-specs {
  display: flex;
  gap: 10px;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink);
}

.lyriq-cv-stamp {
  border: 1px solid var(--ink);
  padding: 1px 5px;
  color: var(--ink);
}

.lyriq-play-ring {
  position: fixed;
  z-index: 25;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--cobalt);
  background: rgba(236, 232, 224, 0.88);
  display: grid;
  place-items: center;
  padding-left: 2px;
}

.lyriq-caption {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: calc(var(--cy) + var(--H) / 2 + 4.2vh);
  display: grid;
  justify-items: center;
  gap: 10px;
  z-index: 20;
  width: min(84vw, 680px);
}

.lyriq-cap-mask {
  overflow: hidden;
  display: grid;
  place-items: center;
  width: 100%;
  text-align: center;
}

.lyriq-cap-title {
  font-size: clamp(26px, 3.3vw, 44px);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.1;
  color: var(--cobalt);
  max-width: min(64vw, 480px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lyriq-cap-sub {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--cobalt);
  max-width: min(74vw, 520px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lyriq-cap-rule {
  width: 18px;
  height: 1px;
  background: var(--cobalt);
}

.lyriq-cap-meta {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}

.lyriq-arrow {
  position: absolute;
  top: 4px;
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
  color: var(--cobalt);
  display: grid;
  place-items: center;
}

.lyriq-arrow-prev { left: calc(50% - min(38vw, 270px) - 22px); }
.lyriq-arrow-next { left: calc(50% + min(38vw, 270px) - 22px); }

@media (min-width: 768px) {
  .lyriq-arrow-prev { left: calc(50% - min(22vw, 270px) - 22px); }
  .lyriq-arrow-next { left: calc(50% + min(22vw, 270px) - 22px); }
}

.lyriq-timeline {
  position: fixed;
  left: 36px;
  right: 36px;
  bottom: 34px;
  height: 40px;
  z-index: 25;
  touch-action: none;
}

@media (max-width: 767px) {
  .lyriq-timeline {
    left: 18px;
    right: 18px;
    bottom: 24px;
  }
}

.lyriq-timeline-line {
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--cobalt);
  opacity: 0.75;
}

.lyriq-timeline-ticks {
  position: absolute;
  top: 6px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lyriq-tick {
  width: 1px;
  height: 7px;
  background: var(--cobalt);
  opacity: 0.4;
}

.lyriq-tick.is-major {
  height: 13px;
  opacity: 0.75;
}

.lyriq-timeline-dot {
  position: absolute;
  top: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--cobalt);
  transform: translateX(-50%);
}

.lyriq-timeline-labels {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--cobalt);
}

.lyriq-cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: 58px;
  height: 58px;
  z-index: 100;
  pointer-events: none;
  display: none;
  place-items: center;
}

@media (pointer: fine) {
  .lyriq-cursor { display: grid; }
}

.lyriq-cursor-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.35s, border-color 0.35s;
}

.lyriq-cursor-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink);
  transition: opacity 0.3s;
}

.lyriq-cursor-label {
  position: absolute;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  letter-spacing: 0.1em;
  color: #fff;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.35s, transform 0.4s;
}

.lyriq-cursor.is-open .lyriq-cursor-ring {
  transform: scale(1.65);
  background: var(--cobalt);
  border-color: var(--cobalt);
}

.lyriq-cursor.is-open .lyriq-cursor-dot { opacity: 0; }
.lyriq-cursor.is-open .lyriq-cursor-label { opacity: 1; transform: scale(1); }
`;

export default LyriqCurvedVault;
