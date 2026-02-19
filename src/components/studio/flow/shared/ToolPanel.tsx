'use client';

import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ToolPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

export const ToolPanel: React.FC<ToolPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  isLoading = false,
  error = null,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);

  // Handle swipe down to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diff = endY - startY.current;

    if (diff > 50) {
      // Swiped down more than 50px
      onClose();
    }
  };

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 bg-[var(--bg-main)] rounded-t-2xl shadow-2xl overflow-hidden max-h-[60vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-[var(--bg-secondary)] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-main)]">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={20} className="text-[var(--text-main)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin">
                <div className="w-8 h-8 border-4 border-[var(--border-main)] border-t-[var(--accent)] rounded-full" />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
              {error}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};
