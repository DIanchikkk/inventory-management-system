import type { Item, ItemPayload } from "../types";
import { http } from "./http";

export async function fetchItems(q?: string): Promise<Item[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const { data } = await http.get<Item[]>(`/items${qs}`);
  return data;
}

export async function fetchItem(id: string): Promise<Item> {
  const { data } = await http.get<Item>(`/items/${id}`);
  return data;
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
