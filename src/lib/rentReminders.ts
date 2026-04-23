// Auto-creates client-side reminders (stored in localStorage, shared with the
// Reminders page) when tenants have rent that's due soon or already late.
// Reminders are keyed deterministically per payment so they don't duplicate.

interface Reminder {
  id: string;
  title: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

interface RentRow {
  id: string;
  status: "pending" | "paid" | "late" | "partial";
  due_date: string;
  amount_due: number | string;
  amount_paid: number | string;
  period_month: number;
  period_year: number;
  tenant_name: string;
}

const STORAGE_KEY = "frs_reminders_v1";

function loadAll(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

function saveAll(items: Reminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function daysBetween(a: Date, b: Date) {
  const ms = b.setHours(0,0,0,0) - a.setHours(0,0,0,0);
  return Math.round(ms / 86_400_000);
}

/**
 * Inspect rent payments and ensure reminders exist for:
 *  - rent due within the next 7 days (pending/partial)
 *  - rent already late
 * Returns the number of new reminders added.
 */
export function syncRentReminders(payments: RentRow[]): number {
  if (!payments?.length) return 0;
  const existing = loadAll();
  const existingIds = new Set(existing.map(r => r.id));
  const today = new Date();
  const additions: Reminder[] = [];

  for (const p of payments) {
    if (p.status === "paid") continue;
    const due = new Date(p.due_date);
    if (Number.isNaN(due.getTime())) continue;
    const diff = daysBetween(new Date(today), new Date(due));
    const period = `${months[p.period_month - 1]} ${p.period_year}`;
    const balance = Number(p.amount_due) - Number(p.amount_paid);

    // Late reminder
    if (p.status === "late" || (diff < 0 && Number(p.amount_paid) < Number(p.amount_due))) {
      const id = `rent-late-${p.id}`;
      if (!existingIds.has(id)) {
        additions.push({
          id,
          title: `Rent overdue — ${p.tenant_name}`,
          notes: `${period} rent is overdue. Balance: KSh ${balance.toLocaleString()}.`,
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Due soon reminder (within next 7 days)
    if (diff >= 0 && diff <= 7) {
      const id = `rent-due-${p.id}`;
      if (!existingIds.has(id)) {
        additions.push({
          id,
          title: `Rent due soon — ${p.tenant_name}`,
          notes: `${period} rent of KSh ${Number(p.amount_due).toLocaleString()} is due on ${p.due_date}.`,
          date: p.due_date,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  if (additions.length) {
    saveAll([...additions, ...existing]);
  }
  return additions.length;
}
