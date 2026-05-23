"use client";

import { createContext, useContext } from "react";
import type { MikeWorkflow } from "@/app/components/shared/types";

interface BuiltinWorkflowsContextValue {
    workflows: MikeWorkflow[];
    ids: Set<string>;
}

const BuiltinWorkflowsContext = createContext<BuiltinWorkflowsContextValue | null>(null);

export function BuiltinWorkflowsProvider({
    workflows,
    children,
}: {
    workflows: MikeWorkflow[];
    children: React.ReactNode;
}) {
    const ids = new Set(workflows.map((w) => w.id));
    return (
        <BuiltinWorkflowsContext.Provider value={{ workflows, ids }}>
            {children}
        </BuiltinWorkflowsContext.Provider>
    );
}

export function useBuiltinWorkflows(): MikeWorkflow[] {
    const ctx = useContext(BuiltinWorkflowsContext);
    if (!ctx) {
        throw new Error("useBuiltinWorkflows must be used within BuiltinWorkflowsProvider");
    }
    return ctx.workflows;
}

export function useBuiltinWorkflowIds(): Set<string> {
    const ctx = useContext(BuiltinWorkflowsContext);
    if (!ctx) {
        throw new Error("useBuiltinWorkflowIds must be used within BuiltinWorkflowsProvider");
    }
    return ctx.ids;
}
