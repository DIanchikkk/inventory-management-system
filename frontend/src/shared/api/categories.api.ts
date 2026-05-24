import type { Category } from "@/shared/types";
import { http } from "./http";

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await http.get<Category[]>("/categories");
  return data;
}

export async function createCategory(name: string): Promise<Category> {
  const { data } = await http.post<Category>("/categories", { name });
  return data;
}
