"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", children, ...props }, ref) => {

        const variants = {
            primary: "bg-vibecode-primary text-white hover:bg-vibecode-primary/90 shadow-[0_4px_20px_rgba(249,115,22,0.2)] edge-light",
            secondary: "bg-vibecode-secondary text-black hover:bg-vibecode-secondary/90 shadow-[0_4px_20px_rgba(34,197,94,0.15)]",
            outline: "border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.03] edge-light",
            ghost: "text-white/40 hover:text-white hover:bg-white/[0.03]",
        };

        const sizes = {
            sm: "h-8 px-3 text-[10px] font-mono tracking-wider uppercase",
            md: "h-10 px-5 text-[11px] font-mono tracking-widest uppercase",
            lg: "h-12 px-8 text-[12px] font-mono tracking-[0.2em] uppercase",
            icon: "h-10 w-10 p-0",
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    "inline-flex items-center justify-center rounded-[6px] transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                    variants[variant],
                    sizes[size],
                    className
                )}

                {...props}
            >
                {children}
            </motion.button>
        );
    }
);
Button.displayName = "Button";

export { Button };
