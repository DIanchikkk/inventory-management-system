export type User = {
  id: string;
  username: string;
  role: string;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  purchase_date: string;
  created_at: string;
  updated_at: string;
};

export type ItemPayload = {
  name: string;
  description: string;
  quantity: number;
  purchase_date: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type InventorySession = {
  id: string;
  created_at: string;
  created_by: string;
  status: string;
};

export type InventoryResult = {
  id: string;
  session_id: string;
  item_id: string;
  expected_quantity: number;
  actual_quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InventorySessionDetail = {
  session: InventorySession;
  items: Item[];
  results: InventoryResult[];
};
