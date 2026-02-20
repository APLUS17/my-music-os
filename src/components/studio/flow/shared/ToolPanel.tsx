'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ToolPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  /** Height as a fraction of viewport, e.g. 0.55 for 55vh */
  heightFraction?: number;
}

export const ToolPanel: React.FC<ToolPanelProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  isLoading = false,
  error = null,
  heightFraction = 0.58,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Handle mount / unmount animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimatingOut(false);
      // Tiny delay so the browser registers initial state before transitioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsAnimatingOut(true), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ---- Touch swipe down to dismiss ----
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 80) {
      onClose();
    }
    setDragY(0);
  };

  // ---- Mouse drag (desktop testing) ----
  const handleMouseDown = (e: React.MouseEvent) => {
    startY.current = e.clientY;
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - startY.current;
      if (delta > 0) setDragY(delta);
    };
    const onUp = () => {
      setIsDragging(false);
      if (dragY > 80) onClose();
      setDragY(0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragY, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen && isAnimatingOut) return null;

  const maxH = Math.round(heightFraction * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150]"
        style={{
          backgroundColor: `rgba(0,0,0,${isVisible ? 0.45 : 0})`,
          backdropFilter: isVisible ? 'blur(4px)' : 'blur(0px)',
          transition: 'background-color 350ms ease, backdrop-filter 350ms ease',
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-[160] flex flex-col overflow-hidden"
        style={{
          maxHeight: `${maxH}vh`,
          minHeight: '40px',
          borderRadius: '22px 22px 0 0',
          background: 'rgba(16, 14, 28, 0.92)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(89,13,242,0.2)',
          transform: `translateY(${isVisible ? dragY : '100%'}px)`,
          transition: isDragging
            ? 'none'
            : `transform 350ms cubic-bezier(0.32, 0.72, 0, 1)`,
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Gradient top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, rgba(89,13,242,0.6), rgba(0,255,255,0.6), rgba(89,13,242,0.6))',
          }}
        />

        {/* Drag Handle */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={handleMouseDown}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.2)',
              transition: 'background 200ms',
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {icon && <span className="text-lg">{icon}</span>}
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.95)',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 200ms',
            }}
          >
            <X size={14} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24" style={{ overscrollBehavior: 'contain' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.1)',
                  borderTopColor: 'rgba(0,255,255,0.8)',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}>
                Thinking...
              </p>
            </div>
          ) : error ? (
            <div
              style={{
                borderRadius: 12,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                padding: '12px 16px',
                fontSize: 13,
                color: 'rgba(252,165,165,0.9)',
              }}
            >
              {error}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </>
  );
};
