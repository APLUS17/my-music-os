"use client";

import { useState, useEffect } from "react";

export interface VisualViewportInfo {
    height: number;
    offsetTop: number;
    width: number;
    offsetLeft: number;
    isKeyboardOpen: boolean;
}

export function useVisualViewport(): VisualViewportInfo {
    const [info, setInfo] = useState<VisualViewportInfo>({
        height: typeof window !== "undefined" ? window.innerHeight : 800,
        offsetTop: 0,
        width: typeof window !== "undefined" ? window.innerWidth : 375,
        offsetLeft: 0,
        isKeyboardOpen: false,
    });

    useEffect(() => {
        if (typeof window === "undefined" || !window.visualViewport) {
            return;
        }

        const handler = () => {
            const vv = window.visualViewport;
            if (!vv) return;

            // Typically, if the visual viewport height is substantially smaller
            // than the window innerHeight, the virtual keyboard is open.
            const threshold = 150; // pixels
            const isKeyboardOpen = window.innerHeight - vv.height > threshold;

            setInfo({
                height: vv.height,
                offsetTop: vv.offsetTop,
                width: vv.width,
                offsetLeft: vv.offsetLeft,
                isKeyboardOpen,
            });
        };

        window.visualViewport.addEventListener("resize", handler);
        window.visualViewport.addEventListener("scroll", handler);

        // Initial call
        handler();

        return () => {
            window.visualViewport?.removeEventListener("resize", handler);
            window.visualViewport?.removeEventListener("scroll", handler);
        };
    }, []);

    return info;
}
