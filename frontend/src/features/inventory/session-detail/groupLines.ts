import type { Item } from "@/shared/types";
import type { GroupBy } from "./constants";

export type LineGroup = { key: string; title: string; items: Item[] };

export function groupLineItems(lineItems: Item[], groupBy: GroupBy): LineGroup[] {
  if (groupBy === "none") return [{ key: "all", title: "Все позиции", items: lineItems }];
  const map = new Map<string, Item[]>();
  for (const it of lineItems) {
    const k = groupBy === "location" ? it.location : it.category;
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, title: key || "Без значения", items }));
}
