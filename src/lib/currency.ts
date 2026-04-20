/**
 * Format a number as Kenyan Shillings.
 * formatKsh(45000) => "KSh 45,000"
 * formatKsh(45000.5, { decimals: 2 }) => "KSh 45,000.50"
 */
export function formatKsh(value: number | string | null | undefined, opts: { decimals?: number } = {}): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  if (Number.isNaN(n)) return "KSh 0";
  const decimals = opts.decimals ?? 0;
  return `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
