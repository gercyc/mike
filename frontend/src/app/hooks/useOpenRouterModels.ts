"use client";

import { useState, useCallback } from "react";
import { listOpenRouterModels, type OpenRouterModel } from "@/app/lib/mikeApi";

type State =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; models: OpenRouterModel[] }
    | { status: "error"; message: string };

export function useOpenRouterModels() {
    const [state, setState] = useState<State>({ status: "idle" });

    const load = useCallback(async () => {
        if (state.status === "loading" || state.status === "loaded") return;
        setState({ status: "loading" });
        try {
            const models = await listOpenRouterModels();
            setState({ status: "loaded", models });
        } catch (err) {
            setState({
                status: "error",
                message: err instanceof Error ? err.message : "Failed to load models",
            });
        }
    }, [state.status]);

    return { state, load };
}
