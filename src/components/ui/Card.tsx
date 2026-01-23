"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
    gradient?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, gradient = false, children, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn(
                    "rounded-[12px] glass-panel p-6 relative group transition-all duration-500",
                    gradient && "bg-gradient-to-br from-vibecode-card to-transparent",
                    className
                )}

                {...props}
            >
                {children}
            </motion.div>
        );
    }
);
Card.displayName = "Card";

export { Card };
