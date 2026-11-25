"use client";

// A library index built as a wheel you turn.
//
// At rest (`turn = 0`) the work sits in a ring (circle) of cards around the
// library title, each card tangent to the circle. The first notch of scroll
// morphs the circle open into the split WheelCarousel layout: the active cover
// glides into the editorial photo frame on the left while every track/beat
// title fans out along a curved rotating wheel on the right.
//
// Everything is driven by a single number — `turn` — in one rAF pass:
// 0 is the circle of cards, 1 is the split wheel with item 0 at the apex, and
// every whole number after that turns one more item onto the apex marker.
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CircleDot } from "lucide-react";

import { cn } from "../../lib/utils";

export interface WorksWheelItem {
  /** Stable unique identifier. Falls back to title + index when omitted. */
  id?: string;
  /** Project or track name. Shown in the curved title wheel and cover caption. */
  title: string;
  /** Cover art. Any src an <img> takes. */
  image: string;
  /** Where the card links to. Omit for a wheel that only browses or uses onSelectItem. */
  href?: string;
  /** Optional subtle metadata shown below the active cover (e.g. "SONG · 120 BPM"). */
  meta?: string;
  /** Optional short line shown below the metadata. */
  subtitle?: string;
  /** Optional fallback accent hex when an image fails to load. */
  accentColor?: string;
}

export interface WorksWheelProps extends Omit<
  React.ComponentPropsWithoutRef<"section">,
  "children"
> {
  items: WorksWheelItem[];
  /** Display heading centered inside the resting ring. */
  label?: string;
  /** Hint shown subtly under the resting ring heading. */
  hint?: string;
  /** CTA label rendered alongside the active item. */
  actionLabel?: string;
  /** Called when the user activates/opens the active item or clicks its CTA. */
  onSelectItem?: (item: WorksWheelItem, index: number) => void;
  /** Optional secondary action shown beside the primary CTA for the active item. */
  secondaryActionLabel?: (item: WorksWheelItem) => string | null;
  onSecondaryAction?: (item: WorksWheelItem, index: number) => void;
  /** Custom empty state rendered when `items` is empty. */
  emptyState?: React.ReactNode;
}

const WHEEL_UNITS = 520;
const DRAG_UNITS = 150;
const SETTLE_MS = 140;
const EASE = 0.16;
const RING_R = 0.72;
const DRAG_CLICK_THRESHOLD_PX = 6;
const TITLE_SPACING_DEG = 14;
const VISIBLE_TITLES = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function shortestAngleToZero(deg: number): number {
  let normalized = (((deg % 360) + 540) % 360) - 180;
  if (normalized === -180) normalized = 180;
  return normalized;
}

export const WorksWheel = React.forwardRef<HTMLElement, WorksWheelProps>(
  function WorksWheel(
    {
      items,
      label = "Library",
      hint = "Scroll or drag to turn",
      actionLabel = "Open",
      onSelectItem,
      secondaryActionLabel,
      onSecondaryAction,
      emptyState,
      className,
      ...props
    },
    forwardedRef,
  ) {
    const count = items.length;
    const reduceMotion = useReducedMotion() ?? false;
    const sectionRef = React.useRef<HTMLElement | null>(null);
    const stageRef = React.useRef<HTMLDivElement | null>(null);
    const ringLabelRef = React.useRef<HTMLDivElement | null>(null);
    const splitStageRef = React.useRef<HTMLDivElement | null>(null);
    const bottomBarRef = React.useRef<HTMLDivElement | null>(null);
    const photoDockRef = React.useRef<HTMLButtonElement | null>(null);
    const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);
    const titleRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const turnRef = React.useRef(0);
    const targetRef = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const settleTimerRef = React.useRef<number | null>(null);
    const activeIndexRef = React.useRef<number>(0);
    const inWheelRef = React.useRef<boolean>(false);

    const dragRef = React.useRef<{
      active: boolean;
      pointerId: number | null;
      startY: number;
      startX: number;
      startTarget: number;
      moved: boolean;
      captured: boolean;
    }>({
      active: false,
      pointerId: null,
      startY: 0,
      startX: 0,
      startTarget: 0,
      moved: false,
      captured: false,
    });
    const suppressClickUntilRef = React.useRef<number>(0);

    const [activeIndex, setActiveIndex] = React.useState<number>(0);
    const [isInWheel, setIsInWheel] = React.useState<boolean>(false);
    const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});

    const setCombinedRef = React.useCallback(
      (node: HTMLElement | null) => {
        sectionRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const applyFrame = React.useCallback(
      (turn: number) => {
        const stage = stageRef.current;
        if (!stage) return;

        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (w <= 0 || h <= 0) return;

        const isMobile = w < 768;
        const morph = smoothstep(turn);
        const wheelPos = Math.max(0, turn - 1);
        const focusedIndex = count > 0 ? clamp(Math.round(wheelPos), 0, count - 1) : 0;

        // Ring card base dimensions (3:4 portrait matching the split photo frame)
        const ringCardW = isMobile
          ? Math.min(w * 0.44, 180)
          : Math.min(w * 0.24, 260);
        const ringCardH = ringCardW * (4 / 3);
        const ringRadius = Math.min(w, h) * (RING_R * 0.5);
        const ringCardScale = clamp(
          ((2 * Math.PI * ringRadius) / Math.max(count, 6) / ringCardW) * 0.72,
          isMobile ? 0.28 : 0.22,
          isMobile ? 0.46 : 0.48,
        );

        // Compute exact target center & scale so the active card glides right into the left photo dock
        let photoTargetX = isMobile ? -w * 0.35 : -Math.min(w - 48, 920) * 0.36;
        let photoTargetY = 0;
        let photoTargetScale = 1;
        const photoDock = photoDockRef.current;
        if (photoDock) {
          const stageRect = stage.getBoundingClientRect();
          const dockRect = photoDock.getBoundingClientRect();
          if (dockRect.width > 0 && dockRect.height > 0) {
            photoTargetX =
              dockRect.left + dockRect.width / 2 - (stageRect.left + stageRect.width / 2);
            photoTargetY =
              dockRect.top + dockRect.height / 2 - (stageRect.top + stageRect.height / 2);
            photoTargetScale = dockRect.width / ringCardW;
          }
        }

        // 1. Update Ring Cards (visible at turn = 0, morphing into the left photo dock)
        for (let i = 0; i < count; i++) {
          const el = cardRefs.current[i];
          if (!el) continue;

          el.style.width = `${ringCardW}px`;
          el.style.height = `${ringCardH}px`;

          const ringAngleDeg = (i / Math.max(count, 1)) * 360 - 90;
          const ringAngleRad = (ringAngleDeg * Math.PI) / 180;
          const ringX = Math.cos(ringAngleRad) * ringRadius;
          const ringY = Math.sin(ringAngleRad) * ringRadius;
          const ringRotZ = shortestAngleToZero(ringAngleDeg + 90);

          const isLeadCard = i === focusedIndex;

          if (isLeadCard) {
            const x = lerp(ringX, photoTargetX, morph);
            const y = lerp(ringY, photoTargetY, morph);
            const rotZ = lerp(ringRotZ, 0, morph);
            const scale = lerp(ringCardScale, photoTargetScale, morph);
            // Hand off smoothly to the crossfading photo frame once settled into split layout
            const opacity = morph < 0.78 ? 1 : clamp(1 - (morph - 0.78) / 0.2, 0, 1);

            el.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
            el.style.opacity = opacity.toFixed(3);
            el.style.pointerEvents = morph < 0.5 ? "auto" : "none";
            el.style.zIndex = "30";
          } else {
            // Non-active ring cards gently expand outward and dissolve away
            const dissolve = clamp(morph * 1.45, 0, 1);
            const x = ringX * (1 + dissolve * 0.22);
            const y = ringY * (1 + dissolve * 0.22);
            const scale = lerp(ringCardScale, ringCardScale * 0.72, dissolve);
            const opacity = 1 - dissolve;

            el.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateZ(${ringRotZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
            el.style.opacity = opacity.toFixed(3);
            el.style.pointerEvents = opacity > 0.15 && morph < 0.45 ? "auto" : "none";
            el.style.zIndex = String(10 + i);
          }
        }

        // 2. Center Ring Title fades out as ring opens
        const ringLabel = ringLabelRef.current;
        if (ringLabel) {
          const labelOpacity = clamp(1 - morph * 2.2, 0, 1);
          const labelScale = 1 - morph * 0.08;
          ringLabel.style.opacity = labelOpacity.toFixed(3);
          ringLabel.style.transform = `translate3d(-50%, -50%, 0) scale(${labelScale.toFixed(4)})`;
          ringLabel.style.pointerEvents = labelOpacity > 0.1 ? "auto" : "none";
        }

        // 3. Split WheelCarousel Stage (left photo + full-height right curved title wheel) fades in
        const splitStage = splitStageRef.current;
        if (splitStage) {
          const splitOpacity = clamp((morph - 0.35) / 0.55, 0, 1);
          const splitShift = (1 - splitOpacity) * 14;
          splitStage.style.opacity = splitOpacity.toFixed(3);
          splitStage.style.transform = `translate3d(0, ${splitShift.toFixed(2)}px, 0)`;
          splitStage.style.pointerEvents = splitOpacity > 0.35 ? "auto" : "none";
        }

        // 3b. Bottom action strip fades in cleanly once in wheel mode
        const bottomBar = bottomBarRef.current;
        if (bottomBar) {
          const barOpacity = clamp((morph - 0.55) / 0.4, 0, 1);
          const barShift = (1 - barOpacity) * 10;
          bottomBar.style.opacity = barOpacity.toFixed(3);
          bottomBar.style.transform = `translate3d(0, ${barShift.toFixed(2)}px, 0)`;
          bottomBar.style.pointerEvents = barOpacity > 0.3 ? "auto" : "none";
        }

        // 4. Curved Title Wheel items positioned along the full-height WheelCarousel arc
        const arcRadius = isMobile ? Math.min(300, h * 0.4) : Math.min(340, h * 0.44);
        for (let i = 0; i < count; i++) {
          const btn = titleRefs.current[i];
          if (!btn) continue;

          const offset = i - wheelPos;
          if (Math.abs(offset) > VISIBLE_TITLES + 1) {
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
            continue;
          }

          const angle = offset * TITLE_SPACING_DEG;
          const radians = (angle * Math.PI) / 180;
          const x = -arcRadius * (1 - Math.cos(radians));
          const y = arcRadius * Math.sin(radians);
          const distance = Math.min(Math.abs(offset) / VISIBLE_TITLES, 1);
          const opacity = Math.cos((distance * Math.PI) / 2);
          const scale = 1 - Math.min(Math.abs(offset) * 0.04, 0.45);
          const isSelected = Math.abs(offset) < 0.5;

          btn.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translateY(-50%) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
          btn.style.opacity = opacity.toFixed(3);
          btn.style.color = isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.45)";
          btn.style.pointerEvents = morph > 0.5 && opacity > 0.12 ? "auto" : "none";
          btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        }

        const nextInWheel = turn >= 0.5;
        if (nextInWheel !== inWheelRef.current) {
          inWheelRef.current = nextInWheel;
          setIsInWheel(nextInWheel);
        }

        if (count > 0 && focusedIndex !== activeIndexRef.current) {
          activeIndexRef.current = focusedIndex;
          setActiveIndex(focusedIndex);
        }
      },
      [count],
    );

    const scheduleTick = React.useCallback(() => {
      if (rafRef.current !== null) return;
      const step = () => {
        const diff = targetRef.current - turnRef.current;
        if (Math.abs(diff) < 0.0005 || reduceMotion) {
          turnRef.current = targetRef.current;
          applyFrame(turnRef.current);
          rafRef.current = null;
          return;
        }
        turnRef.current += diff * EASE;
        applyFrame(turnRef.current);
        rafRef.current = window.requestAnimationFrame(step);
      };
      rafRef.current = window.requestAnimationFrame(step);
    }, [applyFrame, reduceMotion]);

    const to = React.useCallback(
      (nextTurn: number) => {
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        targetRef.current = clamp(nextTurn, 0, count);
        scheduleTick();
      },
      [count, scheduleTick],
    );

    const scheduleSettle = React.useCallback(() => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        targetRef.current = clamp(Math.round(targetRef.current), 0, count);
        scheduleTick();
      }, SETTLE_MS);
    }, [count, scheduleTick]);

    // Clamp turn whenever item count changes (e.g. switching filter tabs)
    React.useEffect(() => {
      targetRef.current = clamp(targetRef.current, 0, count);
      turnRef.current = clamp(turnRef.current, 0, count);
      if (count > 0 && activeIndexRef.current >= count) {
        activeIndexRef.current = count - 1;
        setActiveIndex(count - 1);
      }
      applyFrame(turnRef.current);
    }, [count, applyFrame]);

    // ResizeObserver keeps ring & curved wheel geometry responsive
    React.useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return;

      applyFrame(turnRef.current);
      const ro = new ResizeObserver(() => {
        applyFrame(turnRef.current);
      });
      ro.observe(stage);

      return () => {
        ro.disconnect();
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
      };
    }, [applyFrame]);

    // Non-passive wheel listener so vertical trackpad/mouse scroll turns the wheel
    React.useEffect(() => {
      const section = sectionRef.current;
      if (!section) return;

      const onWheel = (event: WheelEvent) => {
        if (count === 0) return;
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        let dy = event.deltaY;
        if (event.deltaMode === 1) dy *= 32;
        else if (event.deltaMode === 2) dy *= 600;

        targetRef.current = clamp(
          targetRef.current + dy / WHEEL_UNITS,
          0,
          count,
        );
        scheduleTick();
        scheduleSettle();
      };

      section.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        section.removeEventListener("wheel", onWheel);
      };
    }, [count, scheduleTick, scheduleSettle]);

    // Keyboard navigation
    React.useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (count === 0) return;
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }

        if (
          event.key === "ArrowDown" ||
          event.key === "ArrowRight" ||
          event.key === "PageDown"
        ) {
          event.preventDefault();
          to(Math.round(targetRef.current) + 1);
        } else if (
          event.key === "ArrowUp" ||
          event.key === "ArrowLeft" ||
          event.key === "PageUp"
        ) {
          event.preventDefault();
          to(Math.round(targetRef.current) - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          to(0);
        } else if (event.key === "End") {
          event.preventDefault();
          to(count);
        } else if (event.key === "Enter" && inWheelRef.current) {
          const item = items[activeIndexRef.current];
          if (item && onSelectItem) {
            event.preventDefault();
            onSelectItem(item, activeIndexRef.current);
          }
        }
      };

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [count, items, onSelectItem, to]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (count === 0) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        startTarget: targetRef.current,
        moved: false,
        captured: false,
      };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const dy = event.clientY - drag.startY;
      const dx = event.clientX - drag.startX;

      if (!drag.moved && Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
        drag.moved = true;
        if (!drag.captured && stageRef.current) {
          try {
            stageRef.current.setPointerCapture(event.pointerId);
            drag.captured = true;
          } catch {
            // Pointer capture may fail on synthetic events; safe to ignore.
          }
        }
      }

      if (!drag.moved) return;

      targetRef.current = clamp(
        drag.startTarget - dy / DRAG_UNITS,
        0,
        count,
      );
      scheduleTick();
    };

    const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      if (drag.captured && stageRef.current) {
        try {
          stageRef.current.releasePointerCapture(event.pointerId);
        } catch {
          // Safe to ignore if already released.
        }
      }

      const wasDragged = drag.moved;
      drag.active = false;
      drag.pointerId = null;
      drag.captured = false;
      drag.moved = false;

      if (wasDragged) {
        suppressClickUntilRef.current = Date.now() + 120;
        targetRef.current = clamp(Math.round(targetRef.current), 0, count);
        scheduleTick();
      }
    };

    const handleRingCardClick = (index: number, fromKeyboard = false) => {
      if (!fromKeyboard && Date.now() < suppressClickUntilRef.current) return;
      to(index + 1);
    };

    const handleTitleClick = (item: WorksWheelItem, index: number) => {
      if (Date.now() < suppressClickUntilRef.current) return;
      const itemTurn = index + 1;
      const isAlreadySelected =
        turnRef.current >= 0.7 && Math.abs(turnRef.current - itemTurn) < 0.35;

      if (!isAlreadySelected) {
        to(itemTurn);
        return;
      }

      if (onSelectItem) {
        onSelectItem(item, index);
      }
    };

    const safeActiveIndex = count > 0 ? clamp(activeIndex, 0, count - 1) : 0;
    const activeItem = count > 0 ? items[safeActiveIndex] : null;
    const activeKey = activeItem
      ? activeItem.id ?? `${activeItem.title}-${safeActiveIndex}`
      : "";
    const activeImageFailed = Boolean(activeKey && failedImages[activeKey]);
    const secondaryLabel =
      activeItem && secondaryActionLabel ? secondaryActionLabel(activeItem) : null;

    const edgeFadeMask =
      "linear-gradient(to bottom, transparent 0%, black 26%, black 74%, transparent 100%)";

    return (
      <section
        ref={setCombinedRef}
        aria-label={label}
        className={cn(
          "relative h-svh w-full overflow-hidden bg-background text-foreground select-none touch-none",
          className,
        )}
        {...props}
      >
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          className={cn(
            "relative h-full w-full",
            count > 0 ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          )}
        >
          {count === 0 && emptyState ? (
            <div className="relative z-30 flex h-full w-full items-center justify-center px-6">
              {emptyState}
            </div>
          ) : (
            /* Center Ring Title (visible at turn = 0) */
            <div
              ref={ringLabelRef}
              className="absolute left-1/2 top-1/2 z-30 flex flex-col items-center justify-center text-center px-4"
              style={{ transform: "translate3d(-50%, -50%, 0)" }}
            >
              <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
                {label}
              </h1>
              <p className="mt-1.5 text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {count === 0 ? "Empty" : hint}
              </p>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => to(1)}
                  className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
                >
                  Browse {count} {count === 1 ? "item" : "items"} ↓
                </button>
              )}
            </div>
          )}

          {/* Ring of Cards (resting state turn = 0, morphing into the left cover frame) */}
          {items.map((item, i) => {
            const key = item.id ?? `${item.title}-${i}`;
            const imageFailed = Boolean(failedImages[key]);

            return (
              <div
                key={key}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                onClick={() => handleRingCardClick(i)}
                role="button"
                tabIndex={!isInWheel ? 0 : -1}
                aria-label={item.title}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRingCardClick(i, true);
                  }
                }}
                className="absolute left-1/2 top-1/2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground rounded-2xl"
                style={{ willChange: "transform, opacity" }}
              >
                <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-white/12 shadow-xl shadow-black/50">
                  {!imageFailed && item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      draggable={false}
                      loading="lazy"
                      onError={() =>
                        setFailedImages((prev) =>
                          prev[key] ? prev : { ...prev, [key]: true },
                        )
                      }
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `radial-gradient(circle at 25% 20%, ${item.accentColor || "#e5a93c"}45, transparent 60%), linear-gradient(145deg, #1c1c1e 0%, #09090b 100%)`,
                      }}
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                  <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                    <span className="truncate text-xs font-medium text-white/90 drop-shadow-sm">
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/65">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Split WheelCarousel Layout — side-by-side on both mobile and desktop (visible for turn >= 1) */}
          {count > 0 && (
            <div
              ref={splitStageRef}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-3 sm:px-8"
              style={{ opacity: 0 }}
            >
              <div className="flex h-full w-full max-w-[920px] flex-row items-stretch">
                {/* Left Column: Centered 3:4 Portrait Cover Art (matches WheelCarousel mobile + desktop) */}
                <div className="flex h-full w-[25%] min-w-[84px] max-w-[240px] shrink-0 items-center justify-center">
                  <button
                    type="button"
                    ref={photoDockRef}
                    onClick={() => {
                      if (Date.now() < suppressClickUntilRef.current) return;
                      if (activeItem && onSelectItem) {
                        onSelectItem(activeItem, safeActiveIndex);
                      }
                    }}
                    className="group relative w-full aspect-[3/4] max-h-[52vh] overflow-hidden rounded-[14px] bg-[#141414] ring-1 ring-white/15 shadow-2xl shadow-black/70 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    aria-label={activeItem ? `Open ${activeItem.title}` : "Open item"}
                  >
                    {activeItem && (
                      <AnimatePresence initial={false} mode="sync">
                        {!activeImageFailed && activeItem.image ? (
                          <motion.img
                            key={`${activeKey}-${activeItem.image}`}
                            src={activeItem.image}
                            alt={activeItem.title}
                            initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.45 }}
                            onError={() =>
                              setFailedImages((prev) =>
                                prev[activeKey] ? prev : { ...prev, [activeKey]: true },
                              )
                            }
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            draggable={false}
                          />
                        ) : (
                          <motion.div
                            key={`${activeKey}-fallback`}
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.35 }}
                            className="absolute inset-0 h-full w-full"
                            style={{
                              background: `radial-gradient(circle at 25% 20%, ${activeItem.accentColor || "#e5a93c"}45, transparent 60%), linear-gradient(145deg, #1c1c1e 0%, #09090b 100%)`,
                            }}
                          />
                        )}
                      </AnimatePresence>
                    )}
                  </button>
                </div>

                {/* Right Column: Full-Height Sweeping Curved Title Wheel */}
                <div
                  role="listbox"
                  aria-label={`${label} titles`}
                  className="relative h-full min-w-0 flex-1 overflow-hidden"
                  style={{
                    maskImage: edgeFadeMask,
                    WebkitMaskImage: edgeFadeMask,
                  }}
                >
                  {/* Apex Marker Dot */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-[0_0_14px_rgba(229,169,60,0.6)]"
                    style={{
                      left: "calc(32% - 16px)",
                      width: 13,
                      height: 13,
                      marginLeft: -13,
                      backgroundColor: "#e5a93c",
                    }}
                  />

                  {items.map((item, index) => {
                    const key = item.id ?? `${item.title}-${index}`;
                    return (
                      <button
                        key={key}
                        ref={(el) => {
                          titleRefs.current[index] = el;
                        }}
                        type="button"
                        role="option"
                        aria-selected={index === safeActiveIndex}
                        onClick={() => handleTitleClick(item, index)}
                        className="absolute top-1/2 origin-left whitespace-nowrap text-left text-[clamp(1rem,4.2vw,1.65rem)] font-medium leading-none tracking-[-0.015em] transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
                        style={{
                          left: "32%",
                          opacity: 0,
                          willChange: "transform, opacity",
                        }}
                      >
                        <span className="inline-block max-w-[46vw] sm:max-w-[38vw] truncate">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Minimal Floating Bottom Bar (Active Metadata, Actions & Return to Ring) */}
          {count > 0 && activeItem && (
            <div
              ref={bottomBarRef}
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-between gap-3 px-4 sm:px-8 pb-5 pt-10 bg-gradient-to-t from-black via-black/80 to-transparent"
              style={{ opacity: 0 }}
            >
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="shrink-0">
                    {String(safeActiveIndex + 1).padStart(2, "0")} /{" "}
                    {String(count).padStart(2, "0")}
                  </span>
                  {activeItem.meta && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="truncate">{activeItem.meta}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {onSelectItem ? (
                    <button
                      type="button"
                      onClick={() => onSelectItem(activeItem, safeActiveIndex)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/12 hover:bg-white/20 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground transition-colors cursor-pointer"
                    >
                      <span>{actionLabel}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  ) : activeItem.href ? (
                    <a
                      href={activeItem.href}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/12 hover:bg-white/20 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground transition-colors"
                    >
                      <span>{actionLabel}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}

                  {secondaryLabel && onSecondaryAction && (
                    <button
                      type="button"
                      onClick={() => onSecondaryAction(activeItem, safeActiveIndex)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>{secondaryLabel}</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => to(0)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/8 hover:bg-white/14 border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors cursor-pointer backdrop-blur-md"
                title="Return to Circle View (Home)"
              >
                <CircleDot className="h-3 w-3" />
                <span>Ring</span>
              </button>
            </div>
          )}
        </div>

        {activeItem && (
          <span className="sr-only" aria-live="polite">
            {activeItem.title}, item {safeActiveIndex + 1} of {count}
          </span>
        )}
      </section>
    );
  },
);

export default WorksWheel;
