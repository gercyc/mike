import type { ColumnFormat } from "../shared/types";

export interface ColumnPreset {
    name: string;
    matches: RegExp;
    prompt: string;
    format: ColumnFormat;
    tags?: string[];
}

export function getPromptPresets(t: (key: string) => string): ColumnPreset[] {
    return [
        {
            name: t("presets.parties.name"),
            matches: /\bpart(y|ies)\b/i,
            format: "bulleted_list",
            prompt: t("presets.parties.prompt"),
        },
        {
            name: t("presets.governingLaw.name"),
            matches: /\bgoverning law\b|\bjurisdiction\b/i,
            format: "text",
            prompt: t("presets.governingLaw.prompt"),
        },
        {
            name: t("presets.effectiveDate.name"),
            matches: /\beffective date\b/i,
            format: "date",
            prompt: t("presets.effectiveDate.prompt"),
        },
        {
            name: t("presets.term.name"),
            matches: /\bterm\b|\bduration\b/i,
            format: "text",
            prompt: t("presets.term.prompt"),
        },
        {
            name: t("presets.termination.name"),
            matches: /\bterminat(e|ion|ing)\b/i,
            format: "text",
            prompt: t("presets.termination.prompt"),
        },
        {
            name: t("presets.changeOfControl.name"),
            matches: /\bchange of control\b/i,
            format: "text",
            prompt: t("presets.changeOfControl.prompt"),
        },
        {
            name: t("presets.confidentiality.name"),
            matches: /\bconfidential(ity)?\b|\bnon-?disclosure\b/i,
            format: "text",
            prompt: t("presets.confidentiality.prompt"),
        },
        {
            name: t("presets.assignment.name"),
            matches: /\bassign(ment|ability)?\b/i,
            format: "yes_no",
            prompt: t("presets.assignment.prompt"),
        },
        {
            name: t("presets.paymentAndFees.name"),
            matches: /\bpayment\b|\bfees?\b/i,
            format: "text",
            prompt: t("presets.paymentAndFees.prompt"),
        },
        {
            name: t("presets.amendment.name"),
            matches: /\bamendment\b|\bvariation\b/i,
            format: "text",
            prompt: t("presets.amendment.prompt"),
        },
        {
            name: t("presets.indemnity.name"),
            matches: /\bindemni(ty|ties|fication)\b/i,
            format: "text",
            prompt: t("presets.indemnity.prompt"),
        },
        {
            name: t("presets.warranties.name"),
            matches: /\bwarrant(y|ies|ing)\b|\brepresentations?\b/i,
            format: "text",
            prompt: t("presets.warranties.prompt"),
        },
        {
            name: t("presets.forceMajeure.name"),
            matches: /\bforce majeure\b/i,
            format: "yes_no",
            prompt: t("presets.forceMajeure.prompt"),
        },
    ];
}

export function getPresetConfig(
    t: (key: string) => string,
    title: string,
): Pick<ColumnPreset, "prompt" | "format" | "tags"> | null {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const presets = getPromptPresets(t);
    const preset = presets.find(({ matches }) => matches.test(trimmed));
    if (!preset) return null;
    return { prompt: preset.prompt, format: preset.format, tags: preset.tags };
}

export function getPresetPrompt(t: (key: string) => string, title: string): string | null {
    return getPresetConfig(t, title)?.prompt ?? null;
}
