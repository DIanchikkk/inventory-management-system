import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { getToken } from "@/shared/api/token";
import { Spinner } from "@/shared/components/ui/Spinner";
import { ProtectedRoute } from "@/app/routes/ProtectedRoute";

const DashboardLayout = lazy(async () => {
  const m = await import("@/layouts/DashboardLayout");
  return { default: m.DashboardLayout };
});
const LoginPage = lazy(async () => {
  const m = await import("@/features/auth/pages/LoginPage");
  return { default: m.LoginPage };
});
const ItemsPage = lazy(async () => {
  const m = await import("@/features/items/pages/ItemsPage");
  return { default: m.ItemsPage };
});
const ItemDetailPage = lazy(async () => {
  const m = await import("@/features/items/pages/ItemDetailPage");
  return { default: m.ItemDetailPage };
});
const InventorySessionsPage = lazy(async () => {
  const m = await import("@/features/inventory/pages/InventorySessionsPage");
  return { default: m.InventorySessionsPage };
});
const SessionDetailPage = lazy(async () => {
  const m = await import("@/features/inventory/session-detail/SessionDetailPage");
  return { default: m.SessionDetailPage };
});
const SessionPrintSheetPage = lazy(async () => {
  const m = await import("@/features/inventory/pages/SessionPrintSheetPage");
  return { default: m.SessionPrintSheetPage };
});
const ReportsPage = lazy(async () => {
  const m = await import("@/features/reports/pages/ReportsPage");
  return { default: m.ReportsPage };
});
const ReplacementReportPage = lazy(async () => {
  const m = await import("@/features/reports/pages/ReplacementReportPage");
  return { default: m.ReplacementReportPage };
});
const QrLabelsPage = lazy(async () => {
  const m = await import("@/features/reports/pages/QrLabelsPage");
  return { default: m.QrLabelsPage };
});
const ReportsStockLedgerPage = lazy(async () => {
  const m = await import("@/features/reports/pages/ReportsStockLedgerPage");
  return { default: m.ReportsStockLedgerPage };
});
const ReportsStockAdjustmentsPage = lazy(async () => {
  const m = await import("@/features/reports/pages/ReportsStockAdjustmentsPage");
  return { default: m.ReportsStockAdjustmentsPage };
});
const StockAdjustmentDetailPage = lazy(async () => {
  const m = await import("@/features/reports/pages/StockAdjustmentDetailPage");
  return { default: m.StockAdjustmentDetailPage };
});
const SettingsPage = lazy(async () => {
  const m = await import("@/features/settings/pages/SettingsPage");
  return { default: m.SettingsPage };
});

function RootRedirect() {
  return getToken() ? <Navigate to="/items" replace /> : <Navigate to="/login" replace />;
}

/** Старые этикетки с /inventory/item/:id — перенаправление на карточку объекта. */
function LegacyInventoryItemQrRedirect() {
  const { itemId } = useParams<{ itemId: string }>();
  return <Navigate to={itemId ? `/items/${itemId}` : "/items"} replace />;
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
            <Route path="inventory/item/:itemId" element={<LegacyInventoryItemQrRedirect />} />
            <Route path="inventory/sessions" element={<InventorySessionsPage />} />
            <Route path="inventory/sessions/:sessionId/print-sheet" element={<SessionPrintSheetPage />} />
            <Route path="inventory/sessions/:sessionId" element={<SessionDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/replacement" element={<ReplacementReportPage />} />
            <Route path="reports/labels" element={<QrLabelsPage />} />
            <Route path="reports/stock-ledger" element={<ReportsStockLedgerPage />} />
            <Route path="reports/stock-adjustments" element={<ReportsStockAdjustmentsPage />} />
            <Route path="reports/stock-adjustments/:adjustmentId" element={<StockAdjustmentDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}
