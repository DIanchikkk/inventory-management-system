import type {
  DiscrepancyItem,
  InventoryResult,
  InventorySession,
  InventorySessionDetail,
  InventorySessionEvent,
  Item,
  PaginatedGlobalStockLedger,
  PaginatedSessionsResponse,
  SessionLinesPage,
  StockLedgerRow,
} from "../types";
import { http } from "./http";

export type CreateSessionBody = {
  item_ids?: string[];
  location?: string;
  category_id?: string;
  /** Примечание к шапке документа (необязательно). */
  notes?: string;
};

export async function createSession(body?: CreateSessionBody): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>("/inventory/sessions", body ?? {});
  return data;
}

export async function fetchSessionStockLedger(sessionId: string): Promise<{
  rows: StockLedgerRow[];
  document_no?: string;
}> {
  const { data } = await http.get<{ rows: StockLedgerRow[]; document_no?: string }>(
    `/inventory/sessions/${sessionId}/stock-ledger`,
  );
  return data;
}

export async function fetchGlobalStockLedger(page = 1, pageSize = 30): Promise<PaginatedGlobalStockLedger> {
  const { data } = await http.get<PaginatedGlobalStockLedger>(
    `/inventory/stock-ledger/global?page=${page}&page_size=${pageSize}`,
  );
  return data;
}

export async function fetchSessions(page = 1, pageSize = 20): Promise<PaginatedSessionsResponse> {
  const { data } = await http.get<PaginatedSessionsResponse>(`/inventory/sessions?page=${page}&page_size=${pageSize}`);
  return data;
}

export async function fetchSessionDetail(id: string): Promise<InventorySessionDetail> {
  const { data } = await http.get<InventorySessionDetail>(`/inventory/sessions/${id}`);
  return data;
}

export type SessionRegistryRow = {
  item: Item;
  result?: InventoryResult;
};

/** Загружает все строки сессии (несколько запросов по page_size ≤ 100) для печатных форм. */
export async function fetchSessionRegistryRows(sessionId: string): Promise<{
  rows: SessionRegistryRow[];
  totalDeclared: number;
}> {
  const itemsMap = new Map<string, Item>();
  const resultsMap = new Map<string, InventoryResult>();
  let totalDeclared = 0;
  let page = 1;
  const maxPages = 300;

  while (page <= maxPages) {
    const data = await fetchSessionLines(sessionId, {
      page,
      page_size: 100,
      filter: "all",
      group_by: "none",
    });
    totalDeclared = Number(data.total);
    for (const it of data.items) itemsMap.set(it.id, it);
    for (const r of data.results) resultsMap.set(r.item_id, r);

    if (data.items.length === 0) break;
    if (itemsMap.size >= totalDeclared && totalDeclared > 0) break;
    page += 1;
  }

  const items = Array.from(itemsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
  );
  const rows: SessionRegistryRow[] = items.map((item) => ({
    item,
    result: resultsMap.get(item.id),
  }));

  return { rows, totalDeclared };
}

export async function fetchSessionLines(
  sessionId: string,
  params: {
    page?: number;
    page_size?: number;
    filter?: string;
    group_by?: string;
    q?: string;
    location?: string;
  } = {},
): Promise<SessionLinesPage> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.page_size) sp.set("page_size", String(params.page_size));
  if (params.filter) sp.set("filter", params.filter);
  if (params.group_by) sp.set("group_by", params.group_by);
  if (params.q) sp.set("q", params.q);
  if (params.location) sp.set("location", params.location);
  const qs = sp.toString();
  const { data } = await http.get<SessionLinesPage>(`/inventory/sessions/${sessionId}/lines${qs ? `?${qs}` : ""}`);
  return data;
}

export async function postSessionResult(
  sessionId: string,
  body: { item_id: string; actual_quantity: number },
): Promise<InventoryResult> {
  const { data } = await http.post<InventoryResult>(`/inventory/sessions/${sessionId}/results`, body);
  return data;
}

export async function postSessionResultsBatch(
  sessionId: string,
  rows: { item_id: string; actual_quantity: number; comment?: string }[],
): Promise<InventoryResult[]> {
  const { data } = await http.post<InventoryResult[]>(
    `/inventory/sessions/${sessionId}/results/batch`,
    rows,
  );
  return data;
}

export async function completeSession(
  sessionId: string,
  body: { expected_updated_at?: string; allow_incomplete?: boolean } = {},
): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>(`/inventory/sessions/${sessionId}/complete`, body);
  return data;
}

export async function sendSessionToReview(
  sessionId: string,
  body: { expected_updated_at?: string } = {},
): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>(`/inventory/sessions/${sessionId}/review`, body);
  return data;
}

export async function archiveSession(
  sessionId: string,
  body: { expected_updated_at?: string } = {},
): Promise<InventorySession> {
  const { data } = await http.post<InventorySession>(`/inventory/sessions/${sessionId}/archive`, body);
  return data;
}

export async function exportSessionCsv(sessionId: string): Promise<void> {
  const { data } = await http.get<Blob>(`/inventory/sessions/${sessionId}/export`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-session-${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchDiscrepancies(sessionId: string): Promise<DiscrepancyItem[]> {
  const { data } = await http.get<DiscrepancyItem[]>(`/inventory/sessions/${sessionId}/discrepancies`);
  return data;
}

export async function confirmDiscrepancy(sessionId: string, itemId: string): Promise<InventoryResult> {
  const { data } = await http.post<InventoryResult>(`/inventory/sessions/${sessionId}/discrepancies/${itemId}/confirm`);
  return data;
}

export async function exportDiscrepanciesCsv(sessionId: string): Promise<void> {
  const { data } = await http.get<Blob>(`/inventory/sessions/${sessionId}/discrepancies/export`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `discrepancy-act-${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchSessionAudit(sessionId: string): Promise<InventorySessionEvent[]> {
  const { data } = await http.get<InventorySessionEvent[]>(`/inventory/sessions/${sessionId}/audit`);
  return data;
}

export async function exportSessionAuditCsv(sessionId: string): Promise<void> {
  const { data } = await http.get<Blob>(`/inventory/sessions/${sessionId}/audit/export`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-audit-${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
