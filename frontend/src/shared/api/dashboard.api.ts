import type { DashboardSummary } from "@/shared/types";
import { http } from "./http";

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await http.get<DashboardSummary>("/dashboard/summary");
  return data;
}
