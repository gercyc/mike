import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getTranslations } from "next-intl/server";
import { BuiltinWorkflowsProvider } from "@/contexts/BuiltinWorkflowsContext";
import { getBuiltinWorkflows } from "./builtinWorkflows";

const PROMPT_IDS = [
    "builtin-cp-checklist",
    "builtin-coc-dd",
    "builtin-credit-summary",
    "builtin-sha-summary",
];

function loadPrompts(locale: string): Record<string, string> {
    const prompts: Record<string, string> = {};
    const baseDir = join(process.cwd(), "src", "messages", locale, "workflows-prompts");
    for (const id of PROMPT_IDS) {
        const filePath = join(baseDir, `${id}.md`);
        if (existsSync(filePath)) {
            prompts[id] = readFileSync(filePath, "utf-8");
        }
    }
    return prompts;
}

interface Props {
    locale: string;
    children: React.ReactNode;
}

export async function BuiltinWorkflowsLoader({ locale, children }: Props) {
    const t = await getTranslations({ locale, namespace: "workflows-data" });
    const prompts = loadPrompts(locale);
    const workflows = getBuiltinWorkflows((key: string) => t(key as never), prompts);
    return (
        <BuiltinWorkflowsProvider workflows={workflows}>
            {children}
        </BuiltinWorkflowsProvider>
    );
}
