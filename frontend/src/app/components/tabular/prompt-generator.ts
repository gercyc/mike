type TFunction = (key: string, values?: Record<string, string | number>) => string;

export function getPromptGeneratorPresets(t: TFunction): Array<{
    matches: RegExp;
    prompt: (title: string) => string;
}> {
    return [
        {
            matches: /\bpart(y|ies)\b/i,
            prompt: () => t("promptGenerator.parties.prompt"),
        },
        {
            matches: /\bchange of control\b/i,
            prompt: () => t("promptGenerator.changeOfControl.prompt"),
        },
        {
            matches: /\bterminat(e|ion|ing)\b/i,
            prompt: () => t("promptGenerator.termination.prompt"),
        },
        {
            matches: /\bgoverning law\b|\bjurisdiction\b/i,
            prompt: () => t("promptGenerator.governingLaw.prompt"),
        },
        {
            matches: /\bconfidential(ity)?\b|\bnon-?disclosure\b/i,
            prompt: () => t("promptGenerator.confidentiality.prompt"),
        },
        {
            matches: /\bassign(ment|ability)?\b/i,
            prompt: () => t("promptGenerator.assignment.prompt"),
        },
        {
            matches: /\bpayment\b|\bfees?\b/i,
            prompt: () => t("promptGenerator.paymentAndFees.prompt"),
        },
    ];
}

export function getPresetTabularPrompt(
    t: TFunction,
    title: string,
): string | null {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return null;

    const presets = getPromptGeneratorPresets(t);
    const preset = presets.find(({ matches }) => matches.test(trimmedTitle));
    return preset ? preset.prompt(trimmedTitle) : null;
}

export function buildFallbackTabularPrompt(
    t: TFunction,
    title: string,
): string {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return "";

    return t("promptGenerator.fallbackPrompt", { title: trimmedTitle });
}
