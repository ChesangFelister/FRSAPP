import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKsh } from "@/lib/currency";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";

interface Item { id: string; sku: string | null; name: string; unit: string; qty_on_hand: number; reorder_level: number; unit_cost: number; category: string | null }
interface Movement { id: string; item_id: string; movement_type: string; qty: number; reason: string | null; created_at: string }

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDlg, setItemDlg] = useState(false);
  const [moveDlg, setMoveDlg] = useState(false);
  const [iForm, setIForm] = useState({ name: "", sku: "", unit: "pcs", qty_on_hand: "0", reorder_level: "0", unit_cost: "0", category: "" });
  const [mForm, setMForm] = useState({ item_id: "", movement_type: "in", qty: "0", reason: "" });

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: it }, { data: mv }] = await Promise.all([
      (supabase as any).from("inventory_items").select("*").eq("owner_id", user.id).order("name"),
      (supabase as any).from("stock_movements").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setItems((it as Item[]) ?? []);
    setMovements((mv as Movement[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const saveItem = async () => {
    if (!user || !iForm.name) return toast.error("Name required");
    const { error } = await (supabase as any).from("inventory_items").insert({
      owner_id: user.id, name: iForm.name, sku: iForm.sku || null, unit: iForm.unit,
      qty_on_hand: Number(iForm.qty_on_hand) || 0, reorder_level: Number(iForm.reorder_level) || 0,
      unit_cost: Number(iForm.unit_cost) || 0, category: iForm.category || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Item added"); setItemDlg(false); refresh();
  };
  const saveMovement = async () => {
    if (!user || !mForm.item_id) return toast.error("Item required");
    const { error } = await (supabase as any).from("stock_movements").insert({
      owner_id: user.id, item_id: mForm.item_id, movement_type: mForm.movement_type,
      qty: Number(mForm.qty) || 0, reason: mForm.reason || null, actor_id: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Movement recorded"); setMoveDlg(false); refresh();
  };

  const low = useMemo(() => items.filter((i) => Number(i.qty_on_hand) <= Number(i.reorder_level)), [items]);
  const totalValue = useMemo(() => items.reduce((s, i) => s + Number(i.qty_on_hand) * Number(i.unit_cost), 0), [items]);

  return (
    <LandlordLayout
      title="Inventory"
      action={
        <div className="flex gap-2">
          <Dialog open={moveDlg} onOpenChange={setMoveDlg}>
            <DialogTrigger asChild><Button variant="outline" size="sm">Record movement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Stock movement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Item</Label>
                  <Select value={mForm.item_id} onValueChange={(v) => setMForm({ ...mForm, item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Type</Label>
                  <Select value={mForm.movement_type} onValueChange={(v) => setMForm({ ...mForm, movement_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">In (received)</SelectItem>
                      <SelectItem value="out">Out (issued)</SelectItem>
                      <SelectItem value="adjust">Adjust (set total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Quantity</Label><Input type="number" step="0.001" value={mForm.qty} onChange={(e) => setMForm({ ...mForm, qty: e.target.value })} /></div>
                <div><Label>Reason</Label><Input value={mForm.reason} onChange={(e) => setMForm({ ...mForm, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={saveMovement}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={itemDlg} onOpenChange={setItemDlg}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add inventory item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} /></div>
                  <div><Label>SKU</Label><Input value={iForm.sku} onChange={(e) => setIForm({ ...iForm, sku: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label><Input value={iForm.category} onChange={(e) => setIForm({ ...iForm, category: e.target.value })} /></div>
                  <div><Label>Unit</Label><Input value={iForm.unit} onChange={(e) => setIForm({ ...iForm, unit: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>On hand</Label><Input type="number" value={iForm.qty_on_hand} onChange={(e) => setIForm({ ...iForm, qty_on_hand: e.target.value })} /></div>
                  <div><Label>Reorder lvl</Label><Input type="number" value={iForm.reorder_level} onChange={(e) => setIForm({ ...iForm, reorder_level: e.target.value })} /></div>
                  <div><Label>Unit cost</Label><Input type="number" value={iForm.unit_cost} onChange={(e) => setIForm({ ...iForm, unit_cost: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={saveItem}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Items</div><div className="text-2xl font-serif">{items.length}</div></div>
            <div className="bg-card border border-border p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Stock value</div><div className="text-2xl font-serif">{formatKsh(totalValue)}</div></div>
            <div className="bg-card border border-border p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Low stock</div><div className="text-2xl font-serif">{low.length}</div></div>
          </div>

          <Tabs defaultValue="items" className="space-y-4">
            <TabsList>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
            </TabsList>
            <TabsContent value="items">
              <div className="bg-card border border-border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                    <TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Reorder</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Value</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map((i) => {
                      const isLow = Number(i.qty_on_hand) <= Number(i.reorder_level);
                      return (
                        <TableRow key={i.id} className={isLow ? "bg-destructive/5" : ""}>
                          <TableCell className="font-medium">{i.name}</TableCell>
                          <TableCell>{i.sku ?? "—"}</TableCell>
                          <TableCell>{i.category ?? "—"}</TableCell>
                          <TableCell className="text-right">{Number(i.qty_on_hand)} {i.unit}</TableCell>
                          <TableCell className="text-right">{Number(i.reorder_level)}</TableCell>
                          <TableCell className="text-right">{formatKsh(i.unit_cost, { decimals: 2 })}</TableCell>
                          <TableCell className="text-right">{formatKsh(Number(i.qty_on_hand) * Number(i.unit_cost))}</TableCell>
                        </TableRow>
                      );
                    })}
                    {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No items.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="movements">
              <div className="bg-card border border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.created_at).toLocaleString()}</TableCell>
                        <TableCell>{items.find((i) => i.id === m.item_id)?.name ?? "—"}</TableCell>
                        <TableCell className="capitalize">{m.movement_type}</TableCell>
                        <TableCell className="text-right">{Number(m.qty)}</TableCell>
                        <TableCell className="text-muted-foreground">{m.reason}</TableCell>
                      </TableRow>
                    ))}
                    {movements.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No movements.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </LandlordLayout>
  );
}
