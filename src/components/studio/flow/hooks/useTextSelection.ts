'use client';

import { useEffect, useState, useCallback } from 'react';

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

export const useTextSelection = () => {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const handleSelectionChange = useCallback(() => {
    if (typeof window === 'undefined') return;

    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      const text = sel.toString();
      const range = sel.getRangeAt(0);

      // Get the actual offset within the document
      const preRange = range.cloneRange();
      preRange.selectNodeContents(document.body);
      preRange.setEnd(range.endContainer, range.endOffset);
      const end = preRange.toString().length;

      setSelection({
        text,
        start: end - text.length,
        end: end,
      });
    } else {
      setSelection(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  return selection;
};

// Hook to detect when user long-presses on an element
export const useLongPress = (callback: () => void, delay = 500) => {
  const [isPressed, setIsPressed] = useState(false);
  let timeoutId: NodeJS.Timeout;

  const handleMouseDown = () => {
    setIsPressed(true);
    timeoutId = setTimeout(() => {
      if (isPressed) {
        callback();
      }
    }, delay);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    if (timeoutId) clearTimeout(timeoutId);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
    if (timeoutId) clearTimeout(timeoutId);
  };

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleMouseDown,
    onTouchEnd: handleMouseUp,
  };
};

// Hook for detecting double-tap
export const useDoubleTap = (callback: () => void, delay = 300) => {
  const [lastTap, setLastTap] = useState<number>(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < delay) {
      callback();
    }
    setLastTap(now);
  };

  return {
    onTouchEnd: handleTap,
    onClick: handleTap,
  };
};
