/**
 * Format stored monetary amounts for display (values are in major units, TZS).
 */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat("sw-TZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${sign}${formatted} TZS`;
}
