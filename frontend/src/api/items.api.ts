import type { Item, ItemHistoryLog, ItemPayload, PaginatedItemsResponse } from "../types";
import { http } from "./http";

type FetchItemsParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  lowStock?: boolean;
  includeRetired?: boolean;
  replacementRemind?: boolean;
  sortBy?: "name" | "quantity" | "purchase_date";
  sortDir?: "asc" | "desc";
};

export async function fetchItems(params: FetchItemsParams = {}): Promise<PaginatedItemsResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.lowStock) search.set("low_stock", "true");
  if (params.includeRetired) search.set("include_retired", "true");
  if (params.replacementRemind) search.set("replacement_remind", "1");
  if (params.sortBy) search.set("sort_by", params.sortBy);
  if (params.sortDir) search.set("sort_dir", params.sortDir);
  const qs = search.toString();
  const { data } = await http.get<PaginatedItemsResponse>(`/items${qs ? `?${qs}` : ""}`);
  return data;
}

export async function fetchItem(id: string): Promise<Item> {
  const { data } = await http.get<Item>(`/items/${id}`);
  return data;
}

export async function fetchItemHistory(itemId: string): Promise<ItemHistoryLog[]> {
  const { data } = await http.get<{ history: ItemHistoryLog[] }>(`/items/${itemId}/history`);
  return data.history ?? [];
}

export type BulkMetaPayload = {
  ids: string[];
  location?: string;
  category?: string;
  category_id?: string;
};

export async function bulkUpdateMeta(payload: BulkMetaPayload): Promise<{ updated: number }> {
  const { data } = await http.post<{ updated: number }>("/items/bulk-meta", payload);
  return data;
}

export type ImportCsvResult = {
  created: number;
  updated: number;
  errors: string[];
};

export async function importItemsCsv(file: File): Promise<ImportCsvResult> {
  const body = new FormData();
  body.append("file", file);
  const { data } = await http.post<ImportCsvResult>("/items/import", body);
  return data;
}

export async function downloadInventorySnapshotJson(): Promise<void> {
  const { data } = await http.get<Blob>("/export/snapshot.json", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-snapshot.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function createItem(payload: ItemPayload): Promise<Item> {
  const { data } = await http.post<Item>("/items", payload);
  return data;
}

export async function updateItem(id: string, payload: ItemPayload): Promise<Item> {
  const { data } = await http.put<Item>(`/items/${id}`, payload);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  await http.delete(`/items/${id}`);
}

export async function exportItemsCsv(): Promise<void> {
  const { data } = await http.get<Blob>("/items/export", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "items.csv";
  a.click();
  URL.revokeObjectURL(url);
}
