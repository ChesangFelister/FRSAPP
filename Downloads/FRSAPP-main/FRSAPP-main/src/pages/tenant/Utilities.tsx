import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatKsh } from "@/lib/currency";
import { Zap, Droplets, Trash2 } from "lucide-react";

interface Bill {
  id: string; utility_type: "power" | "water" | "waste";
  period_month: number; period_year: number;
  consumption: number | null; amount_due: number; amount_paid: number;
  status: string; notes: string | null; published_at: string | null;
}

const iconFor = (t: string) => t === "power" ? <Zap className="h-4 w-4" /> : t === "water" ? <Droplets className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />;

export default function TenantUtilities() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("utility_bills").select("*").not("published_at", "is", null)
      .order("period_year", { ascending: false }).order("period_month", { ascending: false })
      .then(({ data }: any) => { setBills((data as Bill[]) ?? []); setLoading(false); });
  }, [user]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl">Utility bills</h2>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Type</TableHead><TableHead>Period</TableHead>
            <TableHead className="text-right">Consumption</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead><TableHead>Notes</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="capitalize flex items-center gap-2">{iconFor(b.utility_type)} {b.utility_type}</TableCell>
                <TableCell>{b.period_year}-{String(b.period_month).padStart(2, "0")}</TableCell>
                <TableCell className="text-right">{b.consumption ?? "—"}</TableCell>
                <TableCell className="text-right">{formatKsh(b.amount_due, { decimals: 2 })}</TableCell>
                <TableCell className="capitalize">{b.status}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{b.notes}</TableCell>
              </TableRow>
            ))}
            {bills.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No utility bills yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
