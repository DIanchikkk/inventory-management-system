export type User = {
  id: string;
  username: string;
  role: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Item = {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  location: string;
  min_quantity: number;
  purchase_date: string;
  image_url: string;
  service_life_years: number;
  retired_at?: string | null;
  replaced_by_item_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemHistoryLog = {
  id: string;
  item_id: string;
  actor_id?: string | null;
  message: string;
  created_at: string;
};

export type ItemPayload = {
  sku: string;
  name: string;
  category_id: string;
  description: string;
  quantity: number;
  unit: string;
  location: string;
  min_quantity: number;
  purchase_date: string;
  image_url?: string;
  service_life_years?: number;
  retired?: boolean;
  replaced_by_item_id?: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type DashboardSummary = {
  items_total: number;
  items_low_stock: number;
  items_replacement_overdue?: number;
  items_replacement_due_soon?: number;
  sessions_active_or_review: number;
  sessions_completed: number;
  sessions_archived: number;
};

export type InventorySession = {
  id: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
  status: string;
  document_no: string;
  notes?: string;
  filter_location?: string;
  filter_category_id?: string | null;
  filter_category_name?: string;
};

export type InventoryResult = {
  id: string;
  session_id: string;
  item_id: string;
  expected_quantity: number;
  actual_quantity: number;
  status: string;
  counted_by?: string;
  counted_at?: string;
  comment: string;
  recount_count: number;
  discrepancy_confirmed: boolean;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
};

export type DiscrepancyItem = {
  result: InventoryResult;
  item: Item;
};

export type InventorySessionEvent = {
  id: string;
  session_id: string;
  actor_id?: string;
  action: string;
  details: string;
  created_at: string;
};

export type InventorySessionSummary = {
  total: number;
  pending: number;
  match: number;
  mismatch: number;
  missing: number;
};

export type InventorySessionDetail = {
  session: InventorySession;
  summary: InventorySessionSummary;
};

export type SessionLinesPage = {
  items: Item[];
  results: InventoryResult[];
  page: number;
  page_size: number;
  total: number;
};

export type PaginatedItemsResponse = {
  items: Item[];
  page: number;
  page_size: number;
  total: number;
};

export type PaginatedSessionsResponse = {
  sessions: InventorySession[];
  page: number;
  page_size: number;
  total: number;
};

export type StockLedgerRow = {
  id: string;
  session_id: string;
  item_id: string;
  movement: string;
  movement_label: string;
  accounting_qty: number;
  actual_qty: number;
  balance_before: number;
  balance_after: number;
  delta: number;
  created_at: string;
  actor_id?: string | null;
  item_sku: string;
  item_name: string;
};

/** Строка глобального реестра: движение + номер документа-регистратора. */
export type GlobalStockLedgerRow = StockLedgerRow & {
  document_no: string;
};

export type PaginatedGlobalStockLedger = {
  rows: GlobalStockLedgerRow[];
  page: number;
  page_size: number;
  total: number;
};
