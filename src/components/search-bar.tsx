"use client";

import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/translations";
import { haptics, ImpactStyle } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export default function SearchBar({ value, onChange, className }: SearchBarProps) {
    const { language } = useLanguage();

    const handleClear = () => {
        haptics.impact(ImpactStyle.Light);
        onChange("");
    };

    return (
        <div className={`relative w-full max-w-md mx-auto ${className}`}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('searchPlaceholder', language) || "Search for vegetables, fruits..."}
                    className="pl-10 pr-10 h-12 text-base shadow-sm border-2 focus-visible:ring-primary/20"
                    style={{ fontSize: '16px' }} // Prevent iOS zoom
                />
                <AnimatePresence>
                    {value && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-transparent"
                                onClick={handleClear}
                            >
                                <X className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
