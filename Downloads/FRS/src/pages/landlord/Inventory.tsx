import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Plus, Pencil, Trash2, Package, ArrowDown, ArrowUp, RefreshCw, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

interface Property { id: string; name: string }

interface Supplier {
  id: string; name: string; contact_name: string | null;
  phone: string | null; email: string | null; payment_terms: string | null;
  notes: string | null; active: boolean;
}

interface InventoryItem {
  id: string; property_id: string | null; name: string; sku: string | null;
  category: string; unit_of_measure: string; quantity_on_hand: number;
  reorder_level: number; unit_cost: number; location: string | null;
  supplier_id: string | null; notes: string | null;
}

interface StockMovement {
  id: string; item_id: string; movement_type: string;
  quantity: number; quantity_before: number; quantity_after: number;
  unit_cost: number | null; reference: string | null; notes: string | null;
  created_at: string;
}

const CATEGORIES = ["general", "plumbing", "electrical", "cleaning", "furniture", "tools", "safety", "other"];
const MOVEMENT_TYPES = ["purchase", "usage", "adjustment", "transfer", "disposal"] as const;
type MovementType = typeof MOVEMENT_TYPES[number];

const movementConfig: Record<MovementType, { label: string; cls: string; sign: string }> = {
  purchase:   { label: "Purchase",   cls: "text-emerald-600", sign: "+" },
  usage:      { label: "Usage",      cls: "text-amber-600",   sign: "−" },
  adjustment: { label: "Adjustment", cls: "text-blue-600",    sign: "±" },
  transfer:   { label: "Transfer",   cls: "text-purple-600",  sign: "→" },
  disposal:   { label: "Disposal",   cls: "text-red-600",     sign: "−" },
};

const blankItem = {
  property_id: "", name: "", sku: "", category: "general",
  unit_of_measure: "units", quantity_on_hand: 0, reorder_level: 0,
  unit_cost: 0, location: "", supplier_id: "", notes: "",
};
const blankSupplier = {
  name: "", contact_name: "", phone: "", email: "", payment_terms: "", notes: "", active: true,
};

export default function Inventory() {
  const { user } = useAuth();

  const [properties, setProperties]   = useState<Property[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [items, setItems]             = useState<InventoryItem[]>([]);
  const [movements, setMovements]     = useState<StockMovement[]>([]);
  const [loading, setLoading]         = useState(true);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [searchQuery, setSearchQuery]       = useState("");

  // Item dialog
  const [itemOpen, setItemOpen]   = useState(false);
  const [editItem, setEditItem]   = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm]   = useState(blankItem);
  const [itemSaving, setItemSaving] = useState(false);

  // Supplier dialog
  const [supplierOpen, setSupplierOpen]   = useState(false);
  const [editSupplier, setEditSupplier]   = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm]   = useState(blankSupplier);
  const [supplierSaving, setSupplierSaving] = useState(false);

  // Movement dialog
  const [moveOpen, setMoveOpen]   = useState(false);
  const [moveItemId, setMoveItemId] = useState("");
  const [moveType, setMoveType]   = useState<MovementType>("purchase");
  const [moveQty, setMoveQty]     = useState(0);
  const [moveCost, setMoveCost]   = useState(0);
  const [moveRef, setMoveRef]     = useState("");
  const [moveNotes, setMoveNotes] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [propRes, supRes, itemRes, mvRes] = await Promise.all([
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("name"),
      supabase.from("suppliers").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("inventory_items").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("stock_movements").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(200),
    ]);
    setProperties(propRes.data ?? []);
    setSuppliers(supRes.data ?? []);
    setItems(itemRes.data ?? []);
    setMovements(mvRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const propMap     = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p.name])), [properties]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s.name])), [suppliers]);
  const itemMap     = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items]);

  const filteredItems = useMemo(() => items.filter(i => {
    const matchCat  = filterCategory === "all" || i.category === filterCategory;
    const matchProp = filterProperty === "all" || i.property_id === filterProperty;
    const matchQ    = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.sku ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchProp && matchQ;
  }), [items, filterCategory, filterProperty, searchQuery]);

  const lowStockItems = useMemo(() => items.filter(i => i.reorder_level > 0 && i.quantity_on_hand <= i.reorder_level), [items]);

  const totalStockValue = useMemo(() => items.reduce((s, i) => s + i.quantity_on_hand * i.unit_cost, 0), [items]);

  // Item CRUD
  const openNewItem = () => { setEditItem(null); setItemForm(blankItem); setItemOpen(true); };
  const openEditItem = (i: InventoryItem) => {
    setEditItem(i);
    setItemForm({ property_id: i.property_id ?? "", name: i.name, sku: i.sku ?? "", category: i.category, unit_of_measure: i.unit_of_measure, quantity_on_hand: i.quantity_on_hand, reorder_level: i.reorder_level, unit_cost: i.unit_cost, location: i.location ?? "", supplier_id: i.supplier_id ?? "", notes: i.notes ?? "" });
    setItemOpen(true);
  };

  const saveItem = async () => {
    if (!user || !itemForm.name) { toast.error("Item name is required."); return; }
    setItemSaving(true);
    const payload = {
      owner_id: user.id,
      property_id: itemForm.property_id || null,
      name: itemForm.name, sku: itemForm.sku || null,
      category: itemForm.category, unit_of_measure: itemForm.unit_of_measure,
      quantity_on_hand: editItem ? editItem.quantity_on_hand : itemForm.quantity_on_hand, // qty managed via movements
      reorder_level: itemForm.reorder_level, unit_cost: itemForm.unit_cost,
      location: itemForm.location || null,
      supplier_id: itemForm.supplier_id || null,
      notes: itemForm.notes || null,
    };
    const { error } = editItem
      ? await supabase.from("inventory_items").update(payload).eq("id", editItem.id)
      : await supabase.from("inventory_items").insert(payload);
    setItemSaving(false);
    if (error) { toast.error(error.message); return; }
    // If new item with opening stock, record a purchase movement
    if (!editItem && itemForm.quantity_on_hand > 0) {
      const { data: newItem } = await supabase.from("inventory_items").select("id").eq("owner_id", user.id).eq("name", itemForm.name).maybeSingle();
      if (newItem) {
        await supabase.from("stock_movements").insert({
          owner_id: user.id, item_id: newItem.id,
          movement_type: "purchase", quantity: itemForm.quantity_on_hand,
          unit_cost: itemForm.unit_cost, reference: "Opening stock",
        });
      }
    }
    toast.success("Item saved."); setItemOpen(false); setEditItem(null); load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item? All movement history will also be deleted.")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item deleted."); load();
  };

  // Supplier CRUD
  const saveSupplier = async () => {
    if (!user || !supplierForm.name) { toast.error("Supplier name required."); return; }
    setSupplierSaving(true);
    const payload = { owner_id: user.id, ...supplierForm, contact_name: supplierForm.contact_name || null, phone: supplierForm.phone || null, email: supplierForm.email || null, payment_terms: supplierForm.payment_terms || null, notes: supplierForm.notes || null };
    const { error } = editSupplier
      ? await supabase.from("suppliers").update(payload).eq("id", editSupplier.id)
      : await supabase.from("suppliers").insert(payload);
    setSupplierSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Supplier saved."); setSupplierOpen(false); setEditSupplier(null); load();
  };

  // Stock movement
  const openMove = (itemId: string) => {
    setMoveItemId(itemId); setMoveType("purchase"); setMoveQty(0);
    setMoveCost(0); setMoveRef(""); setMoveNotes(""); setMoveOpen(true);
  };

  const submitMovement = async () => {
    if (!user || !moveItemId || moveQty <= 0) { toast.error("Select item and enter quantity > 0."); return; }
    const outTypes: MovementType[] = ["usage", "disposal", "transfer"];
    const isOut = outTypes.includes(moveType);
    const qty = isOut ? -Math.abs(moveQty) : Math.abs(moveQty);

    setMoveSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      owner_id: user.id, item_id: moveItemId,
      movement_type: moveType, quantity: qty,
      unit_cost: moveCost || null, reference: moveRef || null, notes: moveNotes || null,
    });
    setMoveSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Stock movement recorded."); setMoveOpen(false); load();
  };

  const selectedMovements = movements.filter(m => m.item_id === moveItemId);

  return (
    <LandlordLayout title="Inventory" action={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setSupplierOpen(true); setEditSupplier(null); setSupplierForm(blankSupplier); }}>
          <TruckIcon className="h-4 w-4 mr-1" /> Suppliers
        </Button>
        <Button size="sm" onClick={openNewItem}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>
    }>
      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-sm p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Low stock alert — {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} need restocking</p>
            <p className="text-xs text-amber-700 mt-0.5">{lowStockItems.map(i => i.name).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Items",    value: items.length,                      icon: Package,       color: "text-blue-500" },
          { label: "Low Stock",      value: lowStockItems.length,              icon: AlertTriangle, color: "text-amber-500" },
          { label: "Stock Value",    value: formatKsh(totalStockValue),        icon: Package,       color: "text-emerald-600" },
          { label: "Active Suppliers", value: suppliers.filter(s=>s.active).length, icon: TruckIcon, color: "text-purple-500" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-5 pb-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground mb-1">{s.label}</p><p className="text-xl font-semibold">{s.value}</p></div><s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} /></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items">Stock Register</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="lowstock">Low Stock {lowStockItems.length > 0 && <Badge variant="destructive" className="ml-1 h-4 text-[10px] px-1">{lowStockItems.length}</Badge>}</TabsTrigger>
        </TabsList>

        {/* STOCK REGISTER */}
        <TabsContent value="items">
          <div className="flex flex-wrap gap-3 mb-4">
            <Input placeholder="Search items…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-48" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterProperty} onValueChange={setFilterProperty}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All properties" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All properties</SelectItem>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={load} className="h-10"><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                <TableHead>Location</TableHead><TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Reorder</TableHead><TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Stock Value</TableHead><TableHead>Supplier</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : filteredItems.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No items found.</TableCell></TableRow>
                : filteredItems.map(i => {
                  const isLow = i.reorder_level > 0 && i.quantity_on_hand <= i.reorder_level;
                  return (
                    <TableRow key={i.id} className={isLow ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-medium">
                        {i.name}
                        {isLow && <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1.5" />}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.sku ?? "—"}</TableCell>
                      <TableCell><span className="capitalize text-xs">{i.category}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.location ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${isLow ? "text-amber-600" : ""}`}>{i.quantity_on_hand} {i.unit_of_measure}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{i.reorder_level}</TableCell>
                      <TableCell className="text-right text-sm">{formatKsh(i.unit_cost)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatKsh(i.quantity_on_hand * i.unit_cost)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.supplier_id ? supplierMap[i.supplier_id] ?? "—" : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openMove(i.id)}>
                            <RefreshCw className="h-3 w-3 mr-1" />Move
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => openEditItem(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deleteItem(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* MOVEMENTS */}
        <TabsContent value="movements">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Qty Change</TableHead><TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead><TableHead>Reference</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : movements.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No movements yet.</TableCell></TableRow>
                : movements.map(m => {
                  const cfg = movementConfig[m.movement_type as MovementType] ?? { label: m.movement_type, cls: "", sign: "" };
                  const isPositive = m.quantity > 0;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{itemMap[m.item_id] ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${cfg.cls} border-current/20`}>{cfg.label}</Badge></TableCell>
                      <TableCell className={`text-right font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                        {isPositive ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}
                        {" "}{Math.abs(m.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{m.quantity_before}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{m.quantity_after}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reference ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{m.notes ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setSupplierOpen(true); setEditSupplier(null); setSupplierForm(blankSupplier); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Supplier
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead>
                <TableHead>Email</TableHead><TableHead>Payment Terms</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {suppliers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No suppliers added yet.</TableCell></TableRow>
                : suppliers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.contact_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.payment_terms ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={s.active ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>{s.active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditSupplier(s); setSupplierForm({ name:s.name, contact_name:s.contact_name??"", phone:s.phone??"", email:s.email??"", payment_terms:s.payment_terms??"", notes:s.notes??"", active:s.active }); setSupplierOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* LOW STOCK */}
        <TabsContent value="lowstock">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Category</TableHead>
                <TableHead className="text-right">On Hand</TableHead><TableHead className="text-right">Reorder Level</TableHead>
                <TableHead className="text-right">Deficit</TableHead><TableHead>Supplier</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lowStockItems.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">All items are adequately stocked 🎉</TableCell></TableRow>
                : lowStockItems.map(i => (
                  <TableRow key={i.id} className="bg-amber-50/40">
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{i.category}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{i.quantity_on_hand} {i.unit_of_measure}</TableCell>
                    <TableCell className="text-right text-sm">{i.reorder_level}</TableCell>
                    <TableCell className="text-right text-sm text-red-600 font-medium">−{Math.max(0, i.reorder_level - i.quantity_on_hand)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.supplier_id ? supplierMap[i.supplier_id] ?? "—" : "—"}</TableCell>
                    <TableCell><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openMove(i.id)}><Plus className="h-3 w-3 mr-1" />Restock</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* ─── Item Dialog ─── */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Item Name *</Label><Input value={itemForm.name} onChange={e => setItemForm(f=>({...f,name:e.target.value}))} /></div>
              <div><Label>SKU / Code</Label><Input value={itemForm.sku} onChange={e => setItemForm(f=>({...f,sku:e.target.value}))} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm(f=>({...f,category:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Unit of Measure</Label><Input value={itemForm.unit_of_measure} onChange={e => setItemForm(f=>({...f,unit_of_measure:e.target.value}))} placeholder="units, kg, litres…" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {!editItem && <div><Label>Opening Qty</Label><Input type="number" min={0} value={itemForm.quantity_on_hand} onChange={e => setItemForm(f=>({...f,quantity_on_hand:Number(e.target.value)}))} /></div>}
              <div><Label>Reorder Level</Label><Input type="number" min={0} value={itemForm.reorder_level} onChange={e => setItemForm(f=>({...f,reorder_level:Number(e.target.value)}))} /></div>
              <div><Label>Unit Cost (KSh)</Label><Input type="number" min={0} value={itemForm.unit_cost} onChange={e => setItemForm(f=>({...f,unit_cost:Number(e.target.value)}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Storage Location</Label><Input value={itemForm.location} onChange={e => setItemForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Storeroom B" /></div>
              <div><Label>Property</Label>
                <Select value={itemForm.property_id} onValueChange={v => setItemForm(f=>({...f,property_id:v}))}>
                  <SelectTrigger><SelectValue placeholder="General store" /></SelectTrigger>
                  <SelectContent><SelectItem value="">General (no property)</SelectItem>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Preferred Supplier</Label>
              <Select value={itemForm.supplier_id} onValueChange={v => setItemForm(f=>({...f,supplier_id:v}))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{suppliers.filter(s=>s.active).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={itemForm.notes} onChange={e => setItemForm(f=>({...f,notes:e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setItemOpen(false); setEditItem(null); }}>Cancel</Button>
            <Button onClick={saveItem} disabled={itemSaving}>{itemSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Supplier Dialog ─── */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Company Name *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f=>({...f,name:e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Person</Label><Input value={supplierForm.contact_name} onChange={e => setSupplierForm(f=>({...f,contact_name:e.target.value}))} /></div>
              <div><Label>Phone</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f=>({...f,phone:e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={supplierForm.email} onChange={e => setSupplierForm(f=>({...f,email:e.target.value}))} /></div>
              <div><Label>Payment Terms</Label><Input value={supplierForm.payment_terms} onChange={e => setSupplierForm(f=>({...f,payment_terms:e.target.value}))} placeholder="e.g. Net 30" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f=>({...f,notes:e.target.value}))} rows={2} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sup-active" checked={supplierForm.active} onChange={e => setSupplierForm(f=>({...f,active:e.target.checked}))} className="h-4 w-4" />
              <Label htmlFor="sup-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSupplierOpen(false); setEditSupplier(null); }}>Cancel</Button>
            <Button onClick={saveSupplier} disabled={supplierSaving}>{supplierSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Stock Movement Dialog ─── */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Item</Label>
              <Select value={moveItemId} onValueChange={setMoveItemId}>
                <SelectTrigger><SelectValue placeholder="Select item…" /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} (on hand: {i.quantity_on_hand})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Movement Type</Label>
                <Select value={moveType} onValueChange={v => setMoveType(v as MovementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{movementConfig[t].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantity</Label><Input type="number" min={1} value={moveQty} onChange={e => setMoveQty(Number(e.target.value))} /></div>
            </div>
            {moveType === "purchase" && (
              <div><Label>Unit Cost (KSh)</Label><Input type="number" min={0} value={moveCost} onChange={e => setMoveCost(Number(e.target.value))} /></div>
            )}
            <div><Label>Reference / PO Number</Label><Input value={moveRef} onChange={e => setMoveRef(e.target.value)} placeholder="Optional" /></div>
            <div><Label>Notes</Label><Textarea value={moveNotes} onChange={e => setMoveNotes(e.target.value)} rows={2} /></div>
            {moveItemId && (
              <p className="text-xs text-muted-foreground bg-secondary rounded-sm px-3 py-2">
                Current stock: <strong>{items.find(i=>i.id===moveItemId)?.quantity_on_hand ?? "?"}</strong> {items.find(i=>i.id===moveItemId)?.unit_of_measure}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={submitMovement} disabled={moveSaving}>{moveSaving ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
