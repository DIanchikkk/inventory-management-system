export type RowFilter = "all" | "pending" | "mismatch" | "missing" | "match";

export const ROW_FILTER_LABELS: Record<RowFilter, string> = {
  all: "Все",
  pending: "Не посчитано",
  mismatch: "Расхождения",
  missing: "Отсутствуют",
  match: "Совпадения",
};

export type GroupBy = "none" | "location" | "category";

export const PAGE_SIZE = 20;
