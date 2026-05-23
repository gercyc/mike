import type { LucideIcon } from "lucide-react";
import { AlignLeft, List, Hash, DollarSign, ToggleLeft, Calendar, Tag, Percent, Banknote } from "lucide-react";
import type { ColumnFormat } from "../shared/types";

const FORMAT_ICONS: Record<ColumnFormat, LucideIcon> = {
    text: AlignLeft,
    bulleted_list: List,
    number: Hash,
    percentage: Percent,
    monetary_amount: Banknote,
    currency: DollarSign,
    yes_no: ToggleLeft,
    date: Calendar,
    tag: Tag,
};

export function getFormatOptions(t: (key: string) => string): Array<{ value: ColumnFormat; label: string; icon: LucideIcon }> {
    return [
        { value: "text",            label: t("formats.text"),            icon: FORMAT_ICONS.text },
        { value: "bulleted_list",   label: t("formats.bulleted_list"),   icon: FORMAT_ICONS.bulleted_list },
        { value: "number",          label: t("formats.number"),          icon: FORMAT_ICONS.number },
        { value: "percentage",      label: t("formats.percentage"),      icon: FORMAT_ICONS.percentage },
        { value: "monetary_amount", label: t("formats.monetary_amount"), icon: FORMAT_ICONS.monetary_amount },
        { value: "currency",        label: t("formats.currency"),        icon: FORMAT_ICONS.currency },
        { value: "yes_no",          label: t("formats.yes_no"),          icon: FORMAT_ICONS.yes_no },
        { value: "date",            label: t("formats.date"),            icon: FORMAT_ICONS.date },
        { value: "tag",             label: t("formats.tag"),             icon: FORMAT_ICONS.tag },
    ];
}

export function formatLabel(t: (key: string) => string, format: ColumnFormat): string {
    return getFormatOptions(t).find((o) => o.value === format)?.label ?? t("formats.fallback");
}

export function formatIcon(format: ColumnFormat): LucideIcon {
    return FORMAT_ICONS[format] ?? AlignLeft;
}
