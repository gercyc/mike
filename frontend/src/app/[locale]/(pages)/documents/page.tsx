"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Files, ChevronDown, FileText, File, AlertCircle } from "lucide-react";
import { HeaderSearchBtn } from "@/app/components/shared/HeaderSearchBtn";
import { RowActions } from "@/app/components/shared/RowActions";
import { DocViewModal } from "@/app/components/shared/DocViewModal";
import {
    listStandaloneDocuments,
    deleteDocument,
    uploadStandaloneDocument,
    downloadDocumentsZip,
} from "@/app/lib/mikeApi";
import type { MikeDocument } from "@/app/components/shared/types";

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[320px] shrink-0";

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ fileType }: { fileType: string | null }) {
    if (fileType === "pdf") return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    if (fileType === "docx" || fileType === "doc") return <File className="h-4 w-4 text-blue-500 shrink-0" />;
    return <File className="h-4 w-4 text-gray-400 shrink-0" />;
}

function StatusBadge({ status }: { status: MikeDocument["status"] }) {
    if (status === "ready") return <span className="text-xs text-green-600">●</span>;
    if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />;
}

export default function DocumentsPage() {
    const t = useTranslations("documents");
    const tc = useTranslations("common");

    const [documents, setDocuments] = useState<MikeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [viewDoc, setViewDoc] = useState<MikeDocument | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listStandaloneDocuments()
            .then(setDocuments)
            .catch(() => setDocuments([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
                setActionsOpen(false);
            }
        }
        if (actionsOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [actionsOpen]);

    const q = search.toLowerCase();
    const filtered = documents.filter(
        (d) => !q || d.filename.toLowerCase().includes(q),
    );

    const allSelected = filtered.length > 0 && filtered.every((d) => selectedIds.includes(d.id));
    const someSelected = !allSelected && filtered.some((d) => selectedIds.includes(d.id));

    function toggleAll() {
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(filtered.map((d) => d.id));
    }

    function toggleOne(id: string) {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        e.target.value = "";
        setUploading(true);
        try {
            const uploaded = await Promise.all(files.map((f) => uploadStandaloneDocument(f)));
            setDocuments((prev) => [...uploaded, ...prev]);
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteSelected() {
        const ids = [...selectedIds];
        setActionsOpen(false);
        setSelectedIds([]);
        await Promise.all(ids.map((id) => deleteDocument(id).catch(() => {})));
        setDocuments((prev) => prev.filter((d) => !ids.includes(d.id)));
    }

    async function handleDownloadSelected() {
        setActionsOpen(false);
        const ids = [...selectedIds];
        const blob = await downloadDocumentsZip(ids);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "documents.zip";
        a.click();
        URL.revokeObjectURL(url);
    }

    async function handleDeleteOne(doc: MikeDocument) {
        await deleteDocument(doc.id);
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        if (viewDoc?.id === doc.id) setViewDoc(null);
    }

    const toolbarActions = selectedIds.length > 0 ? (
        <div ref={actionsRef} className="relative">
            <button
                onClick={() => setActionsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
                {t("actions")}
                <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {actionsOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 rounded-lg border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
                    <button
                        onClick={handleDownloadSelected}
                        className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        {t("downloadZip")}
                    </button>
                    <button
                        onClick={handleDeleteSelected}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                        {tc("actions.delete")}
                    </button>
                </div>
            )}
        </div>
    ) : null;

    return (
        <div className="flex-1 overflow-y-auto bg-white">
            {/* Header */}
            <div className="mb-1 flex items-center justify-between px-4 py-3 md:px-10">
                <h1 className="text-2xl font-medium font-serif text-gray-900">
                    {t("title")}
                </h1>
                <div className="flex items-center gap-2">
                    <HeaderSearchBtn value={search} onChange={setSearch} placeholder={t("searchPlaceholder")} />
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.md,.html,.tex"
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40"
                        title={t("uploadDocument")}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            {toolbarActions && (
                <div className="flex items-center justify-end gap-3 px-4 md:px-10 py-1.5 border-b border-gray-100 bg-gray-50 text-xs">
                    <span className="text-gray-500 mr-auto">
                        {selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""}
                    </span>
                    {toolbarActions}
                </div>
            )}

            {/* Table */}
            <div className="w-full overflow-x-auto">
                <div className="min-w-max">
                    {/* Header row */}
                    <div className="flex items-center h-8 pr-3 md:pr-10 border-b border-gray-200 text-xs text-gray-500 font-medium select-none">
                        <div className={`sticky left-0 z-[60] ${CHECK_W} relative bg-white flex items-center justify-center self-stretch before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-white`}>
                            {!loading && (
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                    onChange={toggleAll}
                                    className="h-2.5 w-2.5 rounded border-gray-200 cursor-pointer accent-black"
                                />
                            )}
                        </div>
                        <div className={`sticky left-8 z-[60] ${NAME_COL_W} bg-white pl-2 text-left`}>
                            {t("tableHeaders.name")}
                        </div>
                        <div className="ml-auto w-20 shrink-0">{t("tableHeaders.type")}</div>
                        <div className="w-24 shrink-0">{t("tableHeaders.size")}</div>
                        <div className="w-20 shrink-0">{t("tableHeaders.pages")}</div>
                        <div className="w-24 shrink-0">{t("tableHeaders.status")}</div>
                        <div className="w-32 shrink-0">{t("tableHeaders.created")}</div>
                        <div className="w-8 shrink-0" />
                    </div>

                    {/* Body */}
                    {loading ? (
                        <div>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50">
                                    <div className="w-8 shrink-0" />
                                    <div className="flex-1 min-w-0 pl-3 pr-4">
                                        <div className="h-3.5 w-56 rounded bg-gray-100 animate-pulse" />
                                    </div>
                                    <div className="w-20 shrink-0"><div className="h-3 w-8 rounded bg-gray-100 animate-pulse" /></div>
                                    <div className="w-24 shrink-0"><div className="h-3 w-12 rounded bg-gray-100 animate-pulse" /></div>
                                    <div className="w-20 shrink-0"><div className="h-3 w-6 rounded bg-gray-100 animate-pulse" /></div>
                                    <div className="w-24 shrink-0"><div className="h-3 w-14 rounded bg-gray-100 animate-pulse" /></div>
                                    <div className="w-32 shrink-0"><div className="h-3 w-20 rounded bg-gray-100 animate-pulse" /></div>
                                    <div className="w-8 shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
                            {!q ? (
                                <>
                                    <Files className="h-8 w-8 text-gray-300 mb-4" />
                                    <p className="text-2xl font-medium font-serif text-gray-900">
                                        {t("empty.title")}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-400 text-left">
                                        {t("empty.description")}
                                    </p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors shadow-md disabled:opacity-40"
                                    >
                                        + {t("empty.upload")}
                                    </button>
                                </>
                            ) : (
                                <p className="text-sm text-gray-400">{t("noDocumentsFound")}</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            {filtered.map((doc) => {
                                const rowBg = selectedIds.includes(doc.id) ? "bg-gray-50" : "bg-white";
                                return (
                                    <div
                                        key={doc.id}
                                        onClick={() => doc.status === "ready" && setViewDoc(doc)}
                                        className={`group flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50 ${doc.status === "ready" ? "hover:bg-gray-50 cursor-pointer" : ""} transition-colors`}
                                    >
                                        <div
                                            className={`sticky left-0 z-[60] ${CHECK_W} p-2 flex items-center justify-center ${rowBg} group-hover:bg-gray-50`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(doc.id)}
                                                onChange={() => toggleOne(doc.id)}
                                                className="h-2.5 w-2.5 rounded border-gray-200 cursor-pointer accent-black"
                                            />
                                        </div>
                                        <div className={`sticky left-8 z-[60] ${NAME_COL_W} ${rowBg} group-hover:bg-gray-50 pl-2 flex items-center gap-2`}>
                                            <FileIcon fileType={doc.file_type} />
                                            <span className="text-sm text-gray-800 truncate">{doc.filename}</span>
                                        </div>
                                        <div className="ml-auto w-20 shrink-0 text-xs text-gray-500 uppercase tracking-wide">
                                            {doc.file_type ?? "—"}
                                        </div>
                                        <div className="w-24 shrink-0 text-sm text-gray-500">
                                            {doc.size_bytes != null ? formatBytes(doc.size_bytes) : <span className="text-gray-300">—</span>}
                                        </div>
                                        <div className="w-20 shrink-0 text-sm text-gray-500">
                                            {doc.page_count ?? <span className="text-gray-300">—</span>}
                                        </div>
                                        <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs text-gray-500">
                                            <StatusBadge status={doc.status} />
                                            {t(`status.${doc.status}`)}
                                        </div>
                                        <div className="w-32 shrink-0 text-sm text-gray-500">
                                            {doc.created_at ? formatDate(doc.created_at) : <span className="text-gray-300">—</span>}
                                        </div>
                                        <div
                                            className="w-8 shrink-0 flex justify-end"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <RowActions
                                                onDelete={async () => handleDeleteOne(doc)}
                                            />
                                        </div>
                                    </div>
                                );
            })}
                        </div>
                    )}
                </div>
            </div>

            <DocViewModal
                doc={viewDoc}
                onClose={() => setViewDoc(null)}
                onDelete={handleDeleteOne}
            />
        </div>
    );
}
