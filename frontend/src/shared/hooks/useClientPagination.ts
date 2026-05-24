import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

export function useClientPagination<T>(items: T[], pageSize: number, resetKey: string | number) {
  const [pageByKey, setPageByKey] = useState<Record<string, number>>({});
  const key = String(resetKey);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const storedPage = pageByKey[key] ?? 1;
  const page = Math.min(Math.max(1, storedPage), totalPages);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage: Dispatch<SetStateAction<number>> = (next) => {
    setPageByKey((prev) => {
      const current = prev[key] ?? 1;
      const resolved = typeof next === "function" ? (next as (p: number) => number)(current) : next;
      return { ...prev, [key]: resolved };
    });
  };

  return { page, setPage, totalPages, pageItems };
}
