export function plannedReplacementLabel(isoPurchase: string, years: number): string {
  const d = new Date(isoPurchase);
  if (Number.isNaN(d.getTime())) return "—";
  const y = Number.isFinite(years) && years > 0 ? years : 4;
  const due = new Date(d);
  due.setFullYear(d.getFullYear() + y);
  return due.toLocaleDateString("ru-RU");
}
