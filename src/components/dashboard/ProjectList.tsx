"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Music, Trash2, Calendar, ArrowRight } from "lucide-react";
import { deleteProject } from "@/app/actions";
import { useRouter } from "next/navigation";

interface ProjectListProps {
    initialProjects: any[];
}

// Framer Motion Variants for Staggered Grid
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 40, filter: "blur(10px)" }, // Cinematic reveal
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            duration: 0.8,
        },


    },
};


const emptyStateVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
        },


    },
};

export function ProjectList({ initialProjects }: ProjectListProps) {
    const router = useRouter();

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Delete this project?")) {
            await deleteProject(id);
        }
    };

    if (initialProjects.length === 0) {
        return (
            <motion.div
                variants={emptyStateVariants}
                initial="hidden"
                animate="visible"
                className="text-center p-12 border border-dashed border-vibecode-border rounded-xl bg-vibecode-card/50 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ rotate: -10, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 0.5 }}
                    transition={{ delay: 0.2, type: "spring" }}
                >
                    <Music className="w-12 h-12 mx-auto text-vibecode-secondary mb-4" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">No Projects Yet</h3>
                <p className="text-white/40 mb-6">Start your first sonic experiment.</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
        >
            {initialProjects.map((project, index) => (
                <motion.div
                    key={project.id}
                    variants={cardVariants}
                    whileHover={{
                        y: -8,
                        scale: 1.02,
                        transition: { duration: 0.2 }
                    }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Card
                        className="group cursor-pointer hover:border-vibecode-primary/50 relative overflow-hidden transition-colors duration-300"
                        onClick={() => router.push(`/project/${project.id}`)}
                    >
                        {/* Hover Glow Effect */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            className="absolute inset-0 bg-gradient-to-br from-vibecode-primary/10 via-transparent to-vibecode-secondary/5 pointer-events-none"
                        />

                        {/* Animated Orb Background */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-vibecode-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <motion.div
                                    whileHover={{ rotate: 5, scale: 1.1 }}
                                    className="p-2 rounded-lg bg-vibecode-card border border-vibecode-border text-vibecode-secondary"
                                >
                                    <Music size={20} />
                                </motion.div>
                                <motion.button
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => handleDelete(e, project.id)}
                                    className="text-white/20 hover:text-red-500 transition-colors p-1"
                                >
                                    <Trash2 size={16} />
                                </motion.button>
                            </div>

                            <h3 className="text-xl font-serif text-white mb-2 tracking-tight group-hover:text-vibecode-primary transition-colors duration-500">
                                {project.title}
                            </h3>
                            <p className="text-white/40 font-mono text-[10px] tracking-widest uppercase mb-6">
                                {project.status === "draft" ? "System // Draft Concept" : `Status // ${project.status}`}
                            </p>

                            <div className="flex items-center justify-between text-[11px] font-mono text-white/20 border-t border-white/5 pt-4">
                                <div className="flex items-center gap-1.5 uppercase">
                                    <Calendar size={12} className="text-vibecode-secondary" />
                                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: '2-digit'
                                    })}
                                </div>
                                <motion.div
                                    initial={{ x: 0 }}
                                    whileHover={{ x: 4 }}
                                    className="flex items-center gap-1.5 text-white/40 group-hover:text-vibecode-primary transition-colors tracking-[0.1em]"
                                >
                                    OPEN STUDIO <ArrowRight size={12} />
                                </motion.div>
                            </div>

                        </div>
                    </Card>
                </motion.div>
            ))}
        </motion.div>
    );
}
