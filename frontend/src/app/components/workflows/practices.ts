export const PRACTICE_KEYS = [
    "generalTransactions",
    "corporate",
    "finance",
    "litigation",
    "realEstate",
    "tax",
    "employment",
    "ip",
    "competition",
    "techTransactions",
    "projectFinance",
    "ecVc",
    "privateEquity",
    "privateCredit",
    "ecm",
    "dcm",
    "levFin",
    "arbitration",
    "ma",
    "others",
] as const;

export type PracticeKey = (typeof PRACTICE_KEYS)[number];
