import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/token";
import { Spinner } from "./components/ui/Spinner";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const DashboardLayout = lazy(async () => {
  const m = await import("./layouts/DashboardLayout");
  return { default: m.DashboardLayout };
});
const LoginPage = lazy(async () => {
  const m = await import("./pages/LoginPage");
  return { default: m.LoginPage };
});
const ItemsPage = lazy(async () => {
  const m = await import("./pages/ItemsPage");
  return { default: m.ItemsPage };
});
const ItemDetailPage = lazy(async () => {
  const m = await import("./pages/ItemDetailPage");
  return { default: m.ItemDetailPage };
});
const InventorySessionsPage = lazy(async () => {
  const m = await import("./pages/InventorySessionsPage");
  return { default: m.InventorySessionsPage };
});
const SessionDetailPage = lazy(async () => {
  const m = await import("./pages/SessionDetailPage");
  return { default: m.SessionDetailPage };
});
const SessionPrintSheetPage = lazy(async () => {
  const m = await import("./pages/SessionPrintSheetPage");
  return { default: m.SessionPrintSheetPage };
});
const InventoryItemQrLandingPage = lazy(async () => {
  const m = await import("./pages/InventoryItemQrLandingPage");
  return { default: m.InventoryItemQrLandingPage };
});
const ReportsPage = lazy(async () => {
  const m = await import("./pages/ReportsPage");
  return { default: m.ReportsPage };
});
const ReplacementReportPage = lazy(async () => {
  const m = await import("./pages/ReplacementReportPage");
  return { default: m.ReplacementReportPage };
});
const QrLabelsPage = lazy(async () => {
  const m = await import("./pages/QrLabelsPage");
  return { default: m.QrLabelsPage };
});
const ReportsStockLedgerPage = lazy(async () => {
  const m = await import("./pages/ReportsStockLedgerPage");
  return { default: m.ReportsStockLedgerPage };
});
const SettingsPage = lazy(async () => {
  const m = await import("./pages/SettingsPage");
  return { default: m.SettingsPage };
});

function RootRedirect() {
  return getToken() ? <Navigate to="/items" replace /> : <Navigate to="/login" replace />;
}

function AppSuspenseFallback() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "40dvh",
        padding: "2rem",
      }}
    >
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<AppSuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="inventory" element={<Navigate to="/inventory/sessions" replace />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="items/:id" element={<ItemDetailPage />} />
            <Route path="inventory/item/:itemId" element={<InventoryItemQrLandingPage />} />
            <Route path="inventory/sessions" element={<InventorySessionsPage />} />
            <Route path="inventory/sessions/:sessionId/print-sheet" element={<SessionPrintSheetPage />} />
            <Route path="inventory/sessions/:sessionId" element={<SessionDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/replacement" element={<ReplacementReportPage />} />
            <Route path="reports/labels" element={<QrLabelsPage />} />
            <Route path="reports/stock-ledger" element={<ReportsStockLedgerPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}
