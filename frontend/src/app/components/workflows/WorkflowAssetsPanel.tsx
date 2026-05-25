"use client";

import { useEffect, useRef, useState } from "react";
import {
    CodeXml,
    Download,
    FileImage,
    FileText,
    Plus,
    Trash2,
    Upload,
    X,
    Eye,
    Pencil,
    Check,
} from "lucide-react";
import {
    listWorkflowAssets,
    createWorkflowAsset,
    uploadWorkflowAsset,
    updateWorkflowAsset,
    deleteWorkflowAsset,
    getWorkflowAssetDownloadUrl,
} from "@/app/lib/mikeApi";
import type { WorkflowAsset } from "@/app/components/shared/types";
import { useTranslations } from "next-intl";

interface Props {
    workflowId: string;
    readOnly?: boolean;
}

type AssetType = "html" | "image" | "text";

// ---------------------------------------------------------------------------
// Asset type icon
// ---------------------------------------------------------------------------
function AssetIcon({ type, className }: { type: AssetType; className?: string }) {
    if (type === "html") return <CodeXml className={className} />;
    if (type === "image") return <FileImage className={className} />;
    return <FileText className={className} />;
}

// ---------------------------------------------------------------------------
// HTML / Text editor modal
// ---------------------------------------------------------------------------
interface EditorModalProps {
    asset: WorkflowAsset | null;
    workflowId: string;
    onSave: (asset: WorkflowAsset) => void;
    onClose: () => void;
}

function AssetEditorModal({ asset, workflowId, onSave, onClose }: EditorModalProps) {
    const t = useTranslations("workflows.assets");
    const isNew = asset === null;
    const [name, setName] = useState(asset?.name ?? "");
    const [type, setType] = useState<"html" | "text">(
        (asset?.type === "text" ? "text" : "html"),
    );
    const [content, setContent] = useState(asset?.content ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
        if (!name.trim()) { setError(t("nameRequired")); return; }
        setSaving(true);
        setError(null);
        try {
            if (isNew) {
                const created = await createWorkflowAsset(workflowId, { name, type, content });
                onSave(created);
            } else {
                const updated = await updateWorkflowAsset(workflowId, asset.id, { name, content });
                onSave(updated);
            }
        } catch {
            setError(t("saveFailed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-xs">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-900">
                        {isNew ? t("newAsset") : t("editAsset")}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex flex-col gap-3 px-5 pt-4 shrink-0">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-gray-500 block mb-1">
                                {t("name")}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("namePlaceholder")}
                                className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 bg-gray-50"
                            />
                        </div>
                        {isNew && (
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">
                                    {t("type")}
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as "html" | "text")}
                                    className="text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 bg-gray-50"
                                >
                                    <option value="html">HTML</option>
                                    <option value="text">{t("typeText")}</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                {/* Editor */}
                <div className="flex-1 min-h-0 px-5 py-3 flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500 shrink-0">
                        {t("content")}
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        spellCheck={false}
                        placeholder={type === "html" ? t("htmlPlaceholder") : t("textPlaceholder")}
                        className="flex-1 resize-none text-xs text-gray-800 font-mono border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400 bg-gray-50 leading-relaxed"
                    />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 shrink-0 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        {t("cancel")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? t("saving") : t("save")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// HTML preview modal
// ---------------------------------------------------------------------------
function HtmlPreviewModal({ asset, onClose }: { asset: WorkflowAsset; onClose: () => void }) {
    const t = useTranslations("workflows.assets");
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-xs">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-900 truncate pr-4">
                        {asset.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 p-4">
                    <iframe
                        title={t("preview")}
                        srcDoc={asset.content ?? ""}
                        sandbox="allow-same-origin"
                        className="w-full h-full rounded-lg border border-gray-200 bg-white"
                    />
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline rename
// ---------------------------------------------------------------------------
function InlineName({
    value,
    onCommit,
    readOnly,
}: {
    value: string;
    onCommit: (v: string) => void;
    readOnly: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    function startEdit() {
        if (readOnly) return;
        setDraft(value);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    }

    function commit() {
        setEditing(false);
        if (draft.trim() && draft.trim() !== value) onCommit(draft.trim());
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEditing(false);
                    }}
                    className="flex-1 min-w-0 text-sm text-gray-900 border-b border-gray-400 outline-none bg-transparent"
                    autoFocus
                />
                <button onMouseDown={commit} className="text-gray-400 hover:text-gray-700 shrink-0">
                    <Check className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    return (
        <span
            onClick={startEdit}
            className={`text-sm text-gray-800 truncate flex-1 min-w-0 ${!readOnly ? "cursor-text hover:text-gray-900" : ""}`}
        >
            {value}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function WorkflowAssetsPanel({ workflowId, readOnly = false }: Props) {
    const t = useTranslations("workflows.assets");
    const [assets, setAssets] = useState<WorkflowAsset[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [editorAsset, setEditorAsset] = useState<WorkflowAsset | null | false>(false); // false = closed, null = new, WorkflowAsset = edit
    const [previewAsset, setPreviewAsset] = useState<WorkflowAsset | null>(null);

    // Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        listWorkflowAssets(workflowId)
            .then(setAssets)
            .catch(() => setAssets([]))
            .finally(() => setLoading(false));
    }, [workflowId]);

    async function handleDelete(assetId: string) {
        await deleteWorkflowAsset(workflowId, assetId);
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
    }

    async function handleDownload(asset: WorkflowAsset) {
        try {
            const url = await getWorkflowAssetDownloadUrl(workflowId, asset.id);
            const a = document.createElement("a");
            a.href = url;
            a.download = asset.name;
            a.click();
        } catch {}
    }

    function handleEditorSave(saved: WorkflowAsset) {
        setAssets((prev) => {
            const exists = prev.find((a) => a.id === saved.id);
            if (exists) return prev.map((a) => (a.id === saved.id ? saved : a));
            return [saved, ...prev];
        });
        setEditorAsset(false);
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null);
        setUploading(true);
        try {
            const uploaded = await uploadWorkflowAsset(workflowId, file);
            setAssets((prev) => [uploaded, ...prev]);
        } catch {
            setUploadError(t("uploadFailed"));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleRename(assetId: string, name: string) {
        try {
            const updated = await updateWorkflowAsset(workflowId, assetId, { name });
            setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
        } catch {}
    }

    if (loading) {
        return (
            <div className="flex-1 p-6 space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col flex-1 min-h-0">
                {/* Toolbar */}
                {!readOnly && (
                    <div className="flex items-center gap-4 px-8 h-10 border-b border-gray-200 shrink-0">
                        <button
                            onClick={() => setEditorAsset(null)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {t("newHtmlAsset")}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            {uploading ? t("uploading") : t("uploadImage")}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUpload}
                        />
                        {uploadError && (
                            <span className="text-xs text-red-500">{uploadError}</span>
                        )}
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-auto">
                    {assets.length === 0 ? (
                        <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
                            <CodeXml className="h-8 w-8 text-gray-300 mb-4" />
                            <p className="text-2xl font-medium font-serif text-gray-900">
                                {t("emptyTitle")}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 text-left">
                                {t("emptyDesc")}
                            </p>
                            {!readOnly && (
                                <button
                                    onClick={() => setEditorAsset(null)}
                                    className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors shadow-md"
                                >
                                    {t("createFirst")}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="min-w-max">
                            {/* Header row */}
                            <div className="flex items-center h-8 px-8 border-b border-gray-200 text-xs text-gray-500 font-medium select-none">
                                <div className="w-6 shrink-0 mr-3" />
                                <div className="flex-1 min-w-0">{t("colName")}</div>
                                <div className="w-24 shrink-0">{t("colType")}</div>
                                <div className="w-28 shrink-0">{t("colSize")}</div>
                                <div className="w-24 shrink-0" />
                            </div>

                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className="group flex items-center h-10 px-8 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="w-6 shrink-0 mr-3 text-gray-400">
                                        <AssetIcon type={asset.type} className="h-4 w-4" />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-4">
                                        <InlineName
                                            value={asset.name}
                                            onCommit={(name) => handleRename(asset.id, name)}
                                            readOnly={readOnly}
                                        />
                                    </div>

                                    <div className="w-24 shrink-0">
                                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                                            {asset.type}
                                        </span>
                                    </div>

                                    <div className="w-28 shrink-0">
                                        <span className="text-xs text-gray-400">
                                            {asset.size_bytes != null
                                                ? formatBytes(asset.size_bytes)
                                                : "—"}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="w-24 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {asset.type === "html" && (
                                            <button
                                                onClick={() => setPreviewAsset(asset)}
                                                title={t("preview")}
                                                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {asset.type === "image" && (
                                            <button
                                                onClick={() => handleDownload(asset)}
                                                title={t("download")}
                                                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {!readOnly && asset.type !== "image" && (
                                            <button
                                                onClick={() => setEditorAsset(asset)}
                                                title={t("edit")}
                                                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {!readOnly && (
                                            <button
                                                onClick={() => handleDelete(asset.id)}
                                                title={t("delete")}
                                                className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor modal */}
            {editorAsset !== false && (
                <AssetEditorModal
                    asset={editorAsset}
                    workflowId={workflowId}
                    onSave={handleEditorSave}
                    onClose={() => setEditorAsset(false)}
                />
            )}

            {/* Preview modal */}
            {previewAsset && (
                <HtmlPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
            )}
        </>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
