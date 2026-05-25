"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useFetchSingleDoc } from "@/app/hooks/useFetchSingleDoc";

interface Props {
    documentId: string;
    versionId?: string | null;
    initialScrollTop?: number | null;
    onScrollChange?: (scrollTop: number) => void;
}

/**
 * Renders a Markdown document using react-markdown.
 * Fetches from /single-documents/:id/display which returns text/plain for .md files.
 */
export function MdView({
    documentId,
    versionId,
    initialScrollTop,
    onScrollChange,
}: Props) {
    const { result, loading, error } = useFetchSingleDoc(documentId, versionId);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollInitialized = useRef(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || scrollInitialized.current) return;
        if (initialScrollTop) {
            el.scrollTop = initialScrollTop;
        }
        scrollInitialized.current = true;
    }, [initialScrollTop, result]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !onScrollChange) return;
        const handler = () => onScrollChange(el.scrollTop);
        el.addEventListener("scroll", handler, { passive: true });
        return () => el.removeEventListener("scroll", handler);
    }, [onScrollChange]);

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-red-500">
                    {error ?? "Failed to load document."}
                </p>
            </div>
        );
    }

    const text =
        result.type === "plaintext" || result.type === "html"
            ? result.text
            : null;

    if (!text) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">
                    Unable to display this document.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-4 bg-white rounded-lg"
        >
            <div className="prose prose-sm max-w-none font-serif text-gray-800">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                >
                    {text}
                </ReactMarkdown>
            </div>
        </div>
    );
}
