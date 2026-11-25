"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export type DiscCascadePattern =
  | "horizon"
  | "eclipse"
  | "rings"
  | "sunburst"
  | "halftone"
  | "stripes"
  | "mosaic";

export interface DiscCascadeCredit {
  label: string;
  value: string;
}

export interface DiscCascadeReview {
  source: string;
  quote: string;
  rating?: number;
}

export interface DiscCascadeItem {
  id?: string;
  title: string;
  subtitle?: string;
  catalog?: string;
  year?: string;
  length?: string;
  pattern?: DiscCascadePattern;
  palette?: [string, string, string] | string[];
  image?: string;
  credits?: DiscCascadeCredit[];
  reviews?: DiscCascadeReview[];
}

export interface DiscCascadeCarouselProps {
  items: DiscCascadeItem[];
  brand?: string;
  nav?: { label: string; href?: string }[];
  reviews?: boolean;
  frame?: boolean;
  indexLabel?: string;
  background?: string;
  color?: string;
  spin?: number;
  sheen?: number;
  height?: string;
  controls?: boolean;
  hint?: string;
  loop?: boolean;
  className?: string;
  onSelect?: (index: number, item: DiscCascadeItem) => void;
  onIndexChange?: (index: number, item: DiscCascadeItem) => void;
}

const DEFAULT_PALETTES: [string, string, string][] = [
  ["#141414", "#e9e4da", "#ff5500"],
  ["#1b1d1f", "#3f6b3a", "#c9d6c4"],
  ["#18181b", "#a1a1aa", "#f4f4f5"],
];

const PATTERNS: DiscCascadePattern[] = [
  "horizon",
  "eclipse",
  "rings",
  "sunburst",
  "halftone",
  "stripes",
  "mosaic",
];

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates a procedural SVG disc face artwork with curved rim typography,
 * geometric pattern ("horizon" | "eclipse" | "rings" | "sunburst" | "halftone" | "stripes" | "mosaic"),
 * and side/b catalog ring.
 */
function buildProceduralDiscSvg(
  item: DiscCascadeItem,
  index: number,
): string {
  const pattern: DiscCascadePattern =
    item.pattern || PATTERNS[index % PATTERNS.length];
  const rawPalette =
    item.palette && item.palette.length >= 3
      ? item.palette
      : DEFAULT_PALETTES[index % DEFAULT_PALETTES.length];
  const [c0, c1, c2] = [rawPalette[0], rawPalette[1], rawPalette[2]];

  const uid = `d-${index}`;
  let patternMarkup = "";

  switch (pattern) {
    case "horizon":
      patternMarkup = `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${c0}" />
            <stop offset="52%" stop-color="${c1}" stop-opacity="0.35" />
            <stop offset="53%" stop-color="${c2}" />
            <stop offset="100%" stop-color="${c0}" />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#${uid}-sky)" />
        <circle cx="200" cy="195" r="76" fill="${c2}" opacity="0.85" />
        <g stroke="${c1}" stroke-opacity="0.32" stroke-width="1.5">
          <line x1="0" y1="215" x2="400" y2="215" />
          <line x1="0" y1="230" x2="400" y2="230" />
          <line x1="0" y1="248" x2="400" y2="248" />
          <line x1="0" y1="270" x2="400" y2="270" />
          <line x1="0" y1="296" x2="400" y2="296" />
          <line x1="0" y1="328" x2="400" y2="328" />
        </g>
      `;
      break;

    case "eclipse":
      patternMarkup = `
        <defs>
          <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="${c2}" />
            <stop offset="58%" stop-color="${c1}" stop-opacity="0.45" />
            <stop offset="100%" stop-color="${c0}" />
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="${c0}" />
        <circle cx="214" cy="186" r="142" fill="url(#${uid}-glow)" />
        <circle cx="182" cy="212" r="108" fill="${c0}" />
        <circle cx="200" cy="200" r="162" fill="none" stroke="${c1}" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="4 6" />
      `;
      break;

    case "rings":
      patternMarkup = `
        <rect width="400" height="400" fill="${c0}" />
        <g fill="none" stroke-linecap="round">
          <circle cx="200" cy="200" r="176" stroke="${c1}" stroke-opacity="0.22" stroke-width="1.5" />
          <circle cx="200" cy="200" r="154" stroke="${c2}" stroke-opacity="0.7" stroke-width="10" stroke-dasharray="190 120" />
          <circle cx="200" cy="200" r="132" stroke="${c1}" stroke-opacity="0.55" stroke-width="4" />
          <circle cx="200" cy="200" r="112" stroke="${c2}" stroke-opacity="0.45" stroke-width="14" stroke-dasharray="80 90" />
          <circle cx="200" cy="200" r="90" stroke="${c1}" stroke-opacity="0.35" stroke-width="2" />
        </g>
      `;
      break;

    case "sunburst": {
      const rays: string[] = [];
      for (let i = 0; i < 24; i++) {
        const a1 = (i * 15 * Math.PI) / 180;
        const a2 = ((i * 15 + 7.5) * Math.PI) / 180;
        const x1 = 200 + Math.cos(a1) * 240;
        const y1 = 200 + Math.sin(a1) * 240;
        const x2 = 200 + Math.cos(a2) * 240;
        const y2 = 200 + Math.sin(a2) * 240;
        rays.push(
          `<polygon points="200,200 ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="${
            i % 2 === 0 ? c1 : c2
          }" fill-opacity="${i % 2 === 0 ? "0.22" : "0.52"}" />`,
        );
      }
      patternMarkup = `
        <rect width="400" height="400" fill="${c0}" />
        ${rays.join("")}
        <circle cx="200" cy="200" r="118" fill="${c0}" fill-opacity="0.72" />
      `;
      break;
    }

    case "halftone": {
      const dots: string[] = [];
      for (let r = 82; r <= 178; r += 16) {
        const count = Math.round((2 * Math.PI * r) / 20);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const x = 200 + Math.cos(a) * r;
          const y = 200 + Math.sin(a) * r;
          const rad = ((r - 70) / 110) * 4.2 + 1.2;
          const fill = (i + Math.round(r)) % 3 === 0 ? c2 : c1;
          dots.push(
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${fill}" fill-opacity="0.68" />`,
          );
        }
      }
      patternMarkup = `
        <rect width="400" height="400" fill="${c0}" />
        ${dots.join("")}
      `;
      break;
    }

    case "stripes": {
      const bars: string[] = [];
      for (let i = -8; i <= 16; i++) {
        const y = i * 22;
        const color = i % 3 === 0 ? c2 : c1;
        const op = i % 3 === 0 ? 0.78 : 0.25;
        bars.push(
          `<rect x="-60" y="${y}" width="520" height="10" fill="${color}" fill-opacity="${op}" />`,
        );
      }
      patternMarkup = `
        <rect width="400" height="400" fill="${c0}" />
        <g transform="rotate(-32 200 200)">
          ${bars.join("")}
        </g>
        <circle cx="200" cy="200" r="138" fill="none" stroke="${c1}" stroke-opacity="0.4" stroke-width="1.5" />
      `;
      break;
    }

    case "mosaic":
    default: {
      const cells: string[] = [];
      for (let gx = 0; gx < 8; gx++) {
        for (let gy = 0; gy < 8; gy++) {
          const pick = (gx * 3 + gy * 5 + index) % 5;
          if (pick === 0) continue;
          const fill = pick === 1 ? c2 : c1;
          const op = pick === 1 ? 0.72 : pick === 2 ? 0.35 : 0.16;
          cells.push(
            `<rect x="${gx * 50}" y="${gy * 50}" width="48" height="48" rx="6" fill="${fill}" fill-opacity="${op}" />`,
          );
        }
      }
      patternMarkup = `
        <rect width="400" height="400" fill="${c0}" />
        ${cells.join("")}
      `;
      break;
    }
  }

  const displayTitle = escapeXml((item.title || "UNTITLED BEAT").toUpperCase());
  const metaSummary = escapeXml(
    (
      item.credits
        ?.map((c) => `${c.label} ${c.value}`)
        .join(" · ") ||
      item.subtitle ||
      "LYRIQ STUDIO MASTER"
    ).toUpperCase(),
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <clipPath id="${uid}-disc">
        <circle cx="200" cy="200" r="198" />
      </clipPath>
      <path id="${uid}-title-arc" d="M 52,200 A 148,148 0 1,1 348,200" />
      <path id="${uid}-meta-arc" d="M 358,200 A 158,158 0 1,1 42,200" />
    </defs>
    <g clip-path="url(#${uid}-disc)">
      ${patternMarkup}
      <circle cx="200" cy="200" r="196" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" />
      <circle cx="200" cy="200" r="126" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1" />
      <text fill="#ffffff" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="800" letter-spacing="2.5">
        <textPath href="#${uid}-title-arc" startOffset="50%" text-anchor="middle">${displayTitle}</textPath>
      </text>
      <text fill="#e4e4e7" fill-opacity="0.82" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" font-weight="600" letter-spacing="2">
        <textPath href="#${uid}-meta-arc" startOffset="50%" text-anchor="middle">${metaSummary}</textPath>
      </text>
      <text x="118" y="204" fill="#ffffff" fill-opacity="0.85" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" font-weight="700" letter-spacing="1" text-anchor="middle" transform="rotate(-90 118 200)">side/b</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function DiscCascadeCarousel({
  items,
  brand = "",
  nav = [],
  reviews = false,
  frame = false,
  indexLabel = "Beats",
  background = "radial-gradient(120% 90% at 50% 45%, #18181b, #09090b)",
  color = "#f4f4f5",
  spin = 20,
  sheen = 0.75,
  height = "calc(100svh - 130px)",
  controls = true,
  hint = "Drag or scroll to browse discs",
  loop = false,
  className,
  onSelect,
  onIndexChange,
}: DiscCascadeCarouselProps) {
  const count = items.length;
  const stageRef = React.useRef<HTMLDivElement>(null);
  const discRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const posRef = React.useRef(0);
  const velRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const stageSizeRef = React.useRef({ w: 800, h: 600 });
  const dragRef = React.useRef<{
    id: number;
    startX: number;
    startY: number;
    startPos: number;
    lastX: number;
    lastT: number;
    moved: boolean;
  } | null>(null);

  const [selected, setSelected] = React.useState(0);
  const selectedRef = React.useRef(0);

  const indexAt = React.useCallback(
    (pos: number) => {
      if (count <= 0) return 0;
      if (loop) return ((Math.round(pos) % count) + count) % count;
      return Math.max(0, Math.min(count - 1, Math.round(pos)));
    },
    [count, loop],
  );

  const clamp = React.useCallback(
    (pos: number) =>
      loop ? pos : Math.max(0, Math.min(Math.max(0, count - 1), pos)),
    [count, loop],
  );

  const notifyIndex = React.useCallback(
    (idx: number) => {
      if (idx !== selectedRef.current && items[idx]) {
        selectedRef.current = idx;
        setSelected(idx);
        onIndexChange?.(idx, items[idx]);
      }
    },
    [items, onIndexChange],
  );

  React.useEffect(() => {
    if (count > 0 && selectedRef.current >= count) {
      const next = Math.max(0, count - 1);
      posRef.current = next;
      targetRef.current = next;
      selectedRef.current = next;
      setSelected(next);
    }
  }, [count]);

  const paint = React.useCallback(() => {
    const { w, h } = stageSizeRef.current;
    const baseDiameter = Math.max(
      204,
      Math.min(w * 0.48, h * 0.44, 380),
    );
    const stepX = Math.max(baseDiameter * 0.86, Math.min(w * 0.36, 360));
    const pos = posRef.current;

    discRefs.current.forEach((node, index) => {
      if (!node) return;
      let offset = index - pos;
      if (loop && count > 0) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }
      const abs = Math.abs(offset);

      // Horizontal carousel trajectory: active disc centered, neighbors aligned on the horizontal axis
      const tx = offset * stepX;
      const scale = Math.max(0.58, 1 - abs * 0.16);
      const opacity = abs > 2.6 ? 0 : Math.max(0, 1 - Math.max(0, abs - 1.15) * 0.65);

      node.style.width = `${baseDiameter}px`;
      node.style.height = `${baseDiameter}px`;
      node.style.transform = `translate3d(calc(-50% + ${tx.toFixed(1)}px), -50%, 0) scale(${scale.toFixed(3)})`;
      node.style.opacity = String(opacity);
      node.style.zIndex = String(100 - Math.round(abs * 20));
      node.style.pointerEvents = abs > 1.8 ? "none" : "auto";
    });
  }, [count, loop]);

  const animateSpring = React.useCallback(
    (target: number) => {
      targetRef.current = clamp(target);
      notifyIndex(indexAt(targetRef.current));

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      const step = () => {
        const displacement = targetRef.current - posRef.current;
        const springForce = displacement * 0.14;
        velRef.current = (velRef.current + springForce) * 0.76;
        posRef.current += velRef.current;

        paint();

        if (
          Math.abs(displacement) < 0.001 &&
          Math.abs(velRef.current) < 0.001
        ) {
          posRef.current = targetRef.current;
          velRef.current = 0;
          paint();
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [clamp, indexAt, notifyIndex, paint],
  );

  const goTo = React.useCallback(
    (index: number) => {
      const target =
        loop && count > 0
          ? index + Math.round((targetRef.current - index) / count) * count
          : index;
      animateSpring(target);
    },
    [animateSpring, count, loop],
  );

  const nudge = React.useCallback(
    (delta: number) => {
      animateSpring(Math.round(targetRef.current) + delta);
    },
    [animateSpring],
  );

  useIsoLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      stageSizeRef.current = {
        w: el.clientWidth || 800,
        h: el.clientHeight || 600,
      };
      paint();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint, count]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (count <= 0) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;

    const pitch = Math.max(200, stageSizeRef.current.w * 0.34);
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    const vx = (drag.lastX - e.clientX) / pitch;
    velRef.current = (vx / dt) * 16;
    drag.lastX = e.clientX;
    drag.lastT = now;

    posRef.current = clamp(drag.startPos - dx / pitch);
    notifyIndex(indexAt(posRef.current));
    paint();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved;
    dragRef.current = null;
    if (!moved) return;
    const projected = posRef.current + velRef.current * 4.5;
    animateSpring(Math.round(projected));
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (count <= 1) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 8) return;
    e.preventDefault();
    const step = delta > 0 ? 1 : -1;
    animateSpring(Math.round(targetRef.current) + step);
  };

  const active = items[selected];
  const spinDuration = spin > 0 ? `${spin}s` : "0s";
  const clampedSheen = Math.max(0, Math.min(1, sheen));

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={indexLabel || "Disc cascade"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudge(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          nudge(1);
        } else if (e.key === "Enter" && active && onSelect) {
          e.preventDefault();
          onSelect(selected, active);
        }
      }}
      className={cn(
        "relative w-full overflow-hidden select-none outline-none cursor-grab active:cursor-grabbing",
        frame && "rounded-3xl border border-white/10",
        className,
      )}
      style={{
        height,
        background,
        color,
        touchAction: "pan-y",
      }}
    >
      <style>{`
        @keyframes lyriq-disc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Optional Brand & Nav Header */}
      {(brand || nav.length > 0) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 pt-5">
          {brand ? (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
              {brand}
            </span>
          ) : (
            <span />
          )}
          {nav.length > 0 && (
            <nav className="pointer-events-auto flex items-center gap-5 text-xs opacity-70">
              {nav.map((item) => (
                <a
                  key={item.label}
                  href={item.href || "#"}
                  className="hover:opacity-100 transition-opacity"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Top-Left Hardware Spec / Credits Table (BPM, Key, Duration) */}
      {active && active.credits && active.credits.length > 0 && (
        <div className="pointer-events-none absolute left-5 top-4 sm:left-8 sm:top-6 z-30 w-44 sm:w-52">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            <span className="truncate font-semibold text-zinc-200">
              {active.title}
            </span>
            {count > 0 && (
              <span className="tabular-nums text-zinc-500 shrink-0 ml-2">
                {String(selected + 1).padStart(2, "0")}/{String(count).padStart(2, "0")}
              </span>
            )}
          </div>
          <dl className="divide-y divide-white/10 border-t border-b border-white/10 text-[11px] font-mono">
            {active.credits.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-1.5"
              >
                <dt className="uppercase tracking-wider text-zinc-500">
                  {row.label}
                </dt>
                <dd className="tabular-nums font-medium text-zinc-200">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* 3D / Spatial Disc Cascade Stage */}
      <div className="relative h-full w-full">
        {items.map((item, index) => {
          const isSelected = index === selected;
          const artSrc = item.image || buildProceduralDiscSvg(item, index);

          return (
            <div
              key={item.id ?? `${item.title}-${index}`}
              ref={(node) => {
                discRefs.current[index] = node;
              }}
              onClick={() => {
                if (index === selected) {
                  onSelect?.(index, item);
                } else {
                  goTo(index);
                }
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${item.title} (${index + 1} of ${count})`}
              className="absolute left-1/2 top-[57%] sm:top-[53%] rounded-full will-change-transform cursor-pointer"
              style={{
                boxShadow: isSelected
                  ? "0 32px 80px rgba(0, 0, 0, 0.78), 0 0 0 1px rgba(255, 255, 255, 0.14)"
                  : "0 20px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)",
              }}
            >
              {/* Spinning Artwork Layer */}
              <div
                className="relative h-full w-full overflow-hidden rounded-full"
                style={{
                  animation:
                    spin > 0
                      ? `lyriq-disc-spin ${spinDuration} linear infinite`
                      : undefined,
                  animationPlayState: isSelected ? "running" : "paused",
                }}
              >
                <img
                  src={artSrc}
                  alt={item.title}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  className="h-full w-full select-none object-cover rounded-full"
                />

                {/* Concentric Vinyl/Optical Micro-Groove Rings */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    background:
                      "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 5px)",
                  }}
                />
              </div>

              {/* Stationary Anisotropic Specular Sheen Overlay */}
              {clampedSheen > 0 && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    opacity: clampedSheen * 0.55,
                    background:
                      "conic-gradient(from 215deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.38) 28deg, transparent 62deg, transparent 180deg, rgba(255,255,255,0.32) 210deg, transparent 245deg, transparent 360deg)",
                  }}
                />
              )}

              {/* Realistic Polycarbonate & Brushed Aluminum Center Clamp Hub */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: "35%",
                  height: "35%",
                  background:
                    "radial-gradient(circle at 50% 50%, transparent 0%, transparent 29%, #e4e4e7 30%, #a1a1aa 42%, #f4f4f5 54%, rgba(228,228,231,0.75) 68%, rgba(255,255,255,0.22) 96%, rgba(255,255,255,0.45) 100%)",
                  boxShadow:
                    "inset 0 2px 6px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.45)",
                }}
              >
                {/* Inner Clamping Ring Groove */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20"
                  style={{ width: "74%", height: "74%" }}
                />
                {/* Center Spindle Hole */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#09090b]"
                  style={{
                    width: "38%",
                    height: "38%",
                    boxShadow: "inset 0 2px 5px rgba(0,0,0,0.9)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Reviews Row */}
      {reviews && active?.reviews && active.reviews.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center gap-12 px-6 text-center">
          {active.reviews.slice(0, 2).map((rev, i) => (
            <div key={i} className="max-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                {rev.source}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">
                {rev.quote}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Optional Hint & Prev/Next Controls */}
      {(hint || (controls && count > 1)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex items-center justify-between px-6">
          {hint ? (
            <span className="text-[11px] font-mono text-zinc-500">{hint}</span>
          ) : (
            <span />
          )}
          {controls && count > 1 && (
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous disc"
                onClick={() => nudge(-1)}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next disc"
                onClick={() => nudge(1)}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
