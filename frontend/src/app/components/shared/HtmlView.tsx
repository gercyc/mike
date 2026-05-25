"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useFetchSingleDoc } from "@/app/hooks/useFetchSingleDoc";

interface Props {
    documentId: string;
    versionId?: string | null;
    initialScrollTop?: number | null;
    onScrollChange?: (scrollTop: number) => void;
}

/**
 * Renders an HTML document inside a sandboxed iframe using srcdoc.
 * Fetches from /single-documents/:id/display which returns text/html.
 */
export function HtmlView({
    documentId,
    versionId,
    initialScrollTop,
    onScrollChange,
}: Props) {
    const { result, loading, error } = useFetchSingleDoc(documentId, versionId);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const scrollInitialized = useRef(false);

    // Restore scroll position once the iframe loads
    useEffect(() => {
        if (!iframeRef.current || scrollInitialized.current) return;
        const iframe = iframeRef.current;
        const handleLoad = () => {
            if (initialScrollTop && iframe.contentWindow) {
                iframe.contentWindow.scrollTo(0, initialScrollTop);
            }
            scrollInitialized.current = true;

            // Report scroll changes back to the parent
            if (onScrollChange && iframe.contentWindow) {
                iframe.contentWindow.addEventListener(
                    "scroll",
                    () => {
                        onScrollChange(
                            iframe.contentWindow?.scrollY ?? 0,
                        );
                    },
                    { passive: true },
                );
            }
        };
        iframe.addEventListener("load", handleLoad);
        return () => iframe.removeEventListener("load", handleLoad);
    }, [initialScrollTop, onScrollChange]);

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

    if (result.type !== "html") {
        return (
            <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">
                    Unable to display this document as HTML.
                </p>
            </div>
        );
    }

    return (
        <iframe
            ref={iframeRef}
            className="flex-1 w-full border-0 rounded-lg bg-white"
            srcDoc={result.text}
            sandbox="allow-same-origin"
            title="HTML document preview"
        />
    );
}
