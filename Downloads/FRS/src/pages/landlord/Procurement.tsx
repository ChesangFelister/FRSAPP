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
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, PackageCheck, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatKsh } from "@/lib/currency";

type PRStatus = "draft" | "pending_approval" | "approved" | "rejected" | "ordered" | "received" | "cancelled";

interface Property { id: string; name: string }
interface Supplier { id: string; name: string; active: boolean }
interface InventoryItem { id: string; name: string; unit_of_measure: string; unit_cost: number }

interface PRItem {
  id?: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_qty: number;
  notes: string;
}

interface PurchaseRequest {
  id: string;
  property_id: string | null;
  supplier_id: string | null;
  pr_number: string;
  title: string;
  status: PRStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_note: string | null;
  total_amount: number;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  created_at: string;
}

const statusConfig: Record<PRStatus, { label: string; cls: string }> = {
  draft:            { label: "Draft",           cls: "bg-gray-100 text-gray-700 border-gray-200" },
  pending_approval: { label: "Pending Approval",cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved:         { label: "Approved",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
  rejected:         { label: "Rejected",        cls: "bg-red-100 text-red-700 border-red-200" },
  ordered:          { label: "Ordered",         cls: "bg-purple-100 text-purple-700 border-purple-200" },
  received:         { label: "Received",        cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:        { label: "Cancelled",       cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const blankPRItem: PRItem = { item_id: null, description: "", quantity: 1, unit_cost: 0, total_cost: 0, received_qty: 0, notes: "" };

export default function Procurement() {
  const { user } = useAuth();

  const [properties, setProperties]   = useState<Property[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [invItems, setInvItems]       = useState<InventoryItem[]>([]);
  const [prs, setPRs]                 = useState<PurchaseRequest[]>([]);
  const [prItems, setPRItems]         = useState<Record<string, PRItem[]>>({});
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("all");

  // PR Form state
  const [prOpen, setPROpen]           = useState(false);
  const [editPR, setEditPR]           = useState<PurchaseRequest | null>(null);
  const [prForm, setPRForm]           = useState({
    property_id: "", supplier_id: "", title: "", expected_date: "", notes: "",
  });
  const [lineItems, setLineItems]     = useState<PRItem[]>([{ ...blankPRItem }]);
  const [prSaving, setPRSaving]       = useState(false);

  // Rejection dialog
  const [rejectOpen, setRejectOpen]   = useState(false);
  const [rejectPRId, setRejectPRId]   = useState("");
  const [rejectNote, setRejectNote]   = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [propRes, supRes, invRes, prRes] = await Promise.all([
      supabase.from("properties").select("id,name").eq("owner_id", user.id).order("name"),
      supabase.from("suppliers").select("id,name,active").eq("owner_id", user.id).order("name"),
      supabase.from("inventory_items").select("id,name,unit_of_measure,unit_cost").eq("owner_id", user.id).order("name"),
      supabase.from("purchase_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setProperties(propRes.data ?? []);
    setSuppliers(supRes.data ?? []);
    setInvItems(invRes.data ?? []);
    setPRs(prRes.data ?? []);
    setLoading(false);
  };

  const loadPRItems = async (prId: string) => {
    const { data } = await supabase.from("purchase_request_items").select("*").eq("pr_id", prId).order("created_at");
    setPRItems(prev => ({ ...prev, [prId]: data ?? [] }));
  };

  useEffect(() => { load(); }, [user]);

  const propMap     = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p.name])), [properties]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s.name])), [suppliers]);
  const invItemMap  = useMemo(() => Object.fromEntries(invItems.map(i => [i.id, i])), [invItems]);

  const filteredPRs = useMemo(() => prs.filter(p =>
    filterStatus === "all" || p.status === filterStatus
  ), [prs, filterStatus]);

  const stats = useMemo(() => ({
    total:    prs.length,
    pending:  prs.filter(p => p.status === "pending_approval").length,
    approved: prs.filter(p => p.status === "approved").length,
    totalValue: prs.filter(p => !["rejected","cancelled"].includes(p.status)).reduce((s,p) => s + p.total_amount, 0),
  }), [prs]);

  // Line item helpers
  const updateLineItem = (idx: number, key: keyof PRItem, val: string | number | null) => {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== idx) return li;
      const updated = { ...li, [key]: val };
      if (key === "item_id" && val) {
        const inv = invItemMap[val as string];
        if (inv) { updated.description = inv.name; updated.unit_cost = inv.unit_cost; }
      }
      updated.total_cost = updated.quantity * updated.unit_cost;
      return updated;
    }));
  };
  const addLine    = () => setLineItems(prev => [...prev, { ...blankPRItem }]);
  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_,i) => i !== idx));
  const totalAmt   = lineItems.reduce((s,l) => s + l.quantity * l.unit_cost, 0);

  // Save PR (draft or submit)
  const savePR = async (submitForApproval: boolean) => {
    if (!user || !prForm.title || lineItems.length === 0) { toast.error("Title and at least one item are required."); return; }
    if (lineItems.some(l => !l.description)) { toast.error("All line items need a description."); return; }
    setPRSaving(true);

    let prId: string;
    if (editPR) {
      const { error } = await supabase.from("purchase_requests").update({
        property_id: prForm.property_id || null, supplier_id: prForm.supplier_id || null,
        title: prForm.title, expected_date: prForm.expected_date || null, notes: prForm.notes || null,
        status: submitForApproval ? "pending_approval" : "draft",
      }).eq("id", editPR.id);
      if (error) { toast.error(error.message); setPRSaving(false); return; }
      prId = editPR.id;
      // Delete old items and re-insert
      await supabase.from("purchase_request_items").delete().eq("pr_id", prId);
    } else {
      // Get PR number
      const { data: prNumData } = await supabase.rpc("next_pr_number", { _owner_id: user.id });
      const { data: newPR, error } = await supabase.from("purchase_requests").insert({
        owner_id: user.id, requested_by: user.id,
        property_id: prForm.property_id || null, supplier_id: prForm.supplier_id || null,
        pr_number: prNumData ?? `PR-${Date.now()}`,
        title: prForm.title, expected_date: prForm.expected_date || null, notes: prForm.notes || null,
        status: submitForApproval ? "pending_approval" : "draft",
      }).select("id").single();
      if (error || !newPR) { toast.error(error?.message ?? "Failed to create PR"); setPRSaving(false); return; }
      prId = newPR.id;
    }

    // Insert line items
    const itemsPayload = lineItems.map(l => ({
      pr_id: prId, item_id: l.item_id || null,
      description: l.description, quantity: l.quantity, unit_cost: l.unit_cost, received_qty: 0,
      notes: l.notes || null,
    }));
    const { error: itemErr } = await supabase.from("purchase_request_items").insert(itemsPayload);
    setPRSaving(false);
    if (itemErr) { toast.error(itemErr.message); return; }
    toast.success(submitForApproval ? "PR submitted for approval." : "PR saved as draft.");
    setPROpen(false); setEditPR(null); load();
  };

  const openEditPR = async (pr: PurchaseRequest) => {
    setEditPR(pr);
    setPRForm({ property_id: pr.property_id ?? "", supplier_id: pr.supplier_id ?? "", title: pr.title, expected_date: pr.expected_date ?? "", notes: pr.notes ?? "" });
    // Load items
    const { data } = await supabase.from("purchase_request_items").select("*").eq("pr_id", pr.id);
    setLineItems((data ?? []).map(d => ({ id: d.id, item_id: d.item_id, description: d.description, quantity: d.quantity, unit_cost: d.unit_cost, total_cost: d.total_cost, received_qty: d.received_qty, notes: d.notes ?? "" })));
    setPROpen(true);
  };

  const approvePR = async (id: string) => {
    const { error } = await supabase.rpc("approve_purchase_request", { _pr_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("PR approved."); load();
  };

  const rejectPR = async () => {
    if (!rejectNote.trim()) { toast.error("Rejection reason required."); return; }
    setRejectSaving(true);
    const { error } = await supabase.from("purchase_requests").update({ status: "rejected", rejection_note: rejectNote }).eq("id", rejectPRId);
    setRejectSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("PR rejected."); setRejectOpen(false); load();
  };

  const markOrdered = async (id: string) => {
    const { error } = await supabase.from("purchase_requests").update({ status: "ordered" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as ordered."); load();
  };

  const receivePR = async (id: string) => {
    const { error } = await supabase.rpc("receive_purchase_request", { _pr_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("PR received — stock updated."); load();
  };

  const deletePR = async (id: string) => {
    if (!confirm("Delete this purchase request?")) return;
    await supabase.from("purchase_requests").delete().eq("id", id);
    toast.success("PR deleted."); load();
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!prItems[id]) await loadPRItems(id);
  };

  return (
    <LandlordLayout title="Procurement" action={
      <Button size="sm" onClick={() => { setEditPR(null); setPRForm({ property_id:"", supplier_id:"", title:"", expected_date:"", notes:"" }); setLineItems([{...blankPRItem}]); setPROpen(true); }}>
        <Plus className="h-4 w-4 mr-1" /> New Purchase Request
      </Button>
    }>
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total PRs",         value: stats.total },
          { label: "Pending Approval",  value: stats.pending },
          { label: "Approved",          value: stats.approved },
          { label: "Total Value",       value: formatKsh(stats.totalValue) },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground mb-1">{s.label}</p><p className="text-xl font-semibold">{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(statusConfig).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>PR Number</TableHead><TableHead>Title</TableHead><TableHead>Property</TableHead>
            <TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            : filteredPRs.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No purchase requests found.</TableCell></TableRow>
            : filteredPRs.map(pr => (
              <>
                <TableRow key={pr.id} className="cursor-pointer hover:bg-secondary/30">
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleExpand(pr.id)}>
                      {expandedId === pr.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{pr.pr_number}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{pr.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{pr.property_id ? propMap[pr.property_id] ?? "—" : "General"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{pr.supplier_id ? supplierMap[pr.supplier_id] ?? "—" : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatKsh(pr.total_amount)}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${statusConfig[pr.status].cls}`}>{statusConfig[pr.status].label}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(pr.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {pr.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditPR(pr)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await supabase.from("purchase_requests").update({status:"pending_approval"}).eq("id",pr.id); toast.success("Submitted."); load(); }}><Send className="h-3 w-3 mr-1" />Submit</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deletePR(pr.id)}><Trash2 className="h-3 w-3" /></Button>
                        </>
                      )}
                      {pr.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300" onClick={() => approvePR(pr.id)}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => { setRejectPRId(pr.id); setRejectNote(""); setRejectOpen(true); }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>
                        </>
                      )}
                      {pr.status === "approved" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markOrdered(pr.id)}><PackageCheck className="h-3 w-3 mr-1" />Mark Ordered</Button>
                      )}
                      {(pr.status === "approved" || pr.status === "ordered") && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300" onClick={() => receivePR(pr.id)}><PackageCheck className="h-3 w-3 mr-1" />Receive</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === pr.id && (
                  <TableRow key={`${pr.id}-items`} className="bg-secondary/20">
                    <TableCell colSpan={9} className="py-3 px-8">
                      {pr.rejection_note && (
                        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                          <strong>Rejection reason:</strong> {pr.rejection_note}
                        </div>
                      )}
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Line Items</p>
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground"><th className="text-left pb-1">Description</th><th className="text-right pb-1">Qty</th><th className="text-right pb-1">Unit Cost</th><th className="text-right pb-1">Total</th></tr></thead>
                        <tbody>
                          {(prItems[pr.id] ?? []).map((li, idx) => (
                            <tr key={idx} className="border-t border-border/50">
                              <td className="py-1">{li.description}</td>
                              <td className="text-right py-1">{li.quantity}</td>
                              <td className="text-right py-1">{formatKsh(li.unit_cost)}</td>
                              <td className="text-right py-1 font-medium">{formatKsh(li.quantity * li.unit_cost)}</td>
                            </tr>
                          ))}
                          {!prItems[pr.id] && <tr><td colSpan={4} className="py-2 text-muted-foreground">Loading items…</td></tr>}
                        </tbody>
                        <tfoot><tr className="border-t-2 border-border"><td colSpan={3} className="text-right font-medium pt-2">Total</td><td className="text-right font-bold pt-2">{formatKsh(pr.total_amount)}</td></tr></tfoot>
                      </table>
                      {pr.notes && <p className="mt-2 text-xs text-muted-foreground"><strong>Notes:</strong> {pr.notes}</p>}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* ─── PR Form Dialog ─── */}
      <Dialog open={prOpen} onOpenChange={setPROpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPR ? `Edit ${editPR.pr_number}` : "New Purchase Request"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Title / Description *</Label><Input value={prForm.title} onChange={e => setPRForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Plumbing supplies for Block A" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Property</Label>
                <Select value={prForm.property_id} onValueChange={v => setPRForm(f=>({...f,property_id:v}))}>
                  <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent><SelectItem value="">General (no property)</SelectItem>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Supplier</Label>
                <Select value={prForm.supplier_id} onValueChange={v => setPRForm(f=>({...f,supplier_id:v}))}>
                  <SelectTrigger><SelectValue placeholder="TBD" /></SelectTrigger>
                  <SelectContent><SelectItem value="">TBD</SelectItem>{suppliers.filter(s=>s.active).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Expected Delivery Date</Label><Input type="date" value={prForm.expected_date} onChange={e => setPRForm(f=>({...f,expected_date:e.target.value}))} /></div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items *</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-secondary/30 p-2 rounded-sm">
                    <div className="col-span-4">
                      <Label className="text-xs mb-1 block">From inventory</Label>
                      <Select value={li.item_id ?? ""} onValueChange={v => updateLineItem(idx, "item_id", v || null)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select or type below" /></SelectTrigger>
                        <SelectContent><SelectItem value="">Custom item</SelectItem>{invItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs mb-1 block">Description *</Label>
                      <Input className="h-8 text-xs" value={li.description} onChange={e => updateLineItem(idx, "description", e.target.value)} placeholder="Item description" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Qty</Label>
                      <Input className="h-8 text-xs" type="number" min={1} value={li.quantity} onChange={e => updateLineItem(idx, "quantity", Number(e.target.value))} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Unit Cost</Label>
                      <Input className="h-8 text-xs" type="number" min={0} value={li.unit_cost} onChange={e => updateLineItem(idx, "unit_cost", Number(e.target.value))} />
                    </div>
                    <div className="col-span-1 flex items-end pb-0.5">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeLine(idx)} disabled={lineItems.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="col-span-11 text-xs text-right text-muted-foreground">Subtotal: {formatKsh(li.quantity * li.unit_cost)}</div>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm font-semibold mt-2 pr-2">Total: {formatKsh(totalAmt)}</div>
            </div>

            <div><Label>Notes</Label><Textarea value={prForm.notes} onChange={e => setPRForm(f=>({...f,notes:e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPROpen(false); setEditPR(null); }}>Cancel</Button>
            <Button variant="outline" onClick={() => savePR(false)} disabled={prSaving}>{prSaving ? "Saving…" : "Save Draft"}</Button>
            <Button onClick={() => savePR(true)} disabled={prSaving}>{prSaving ? "Submitting…" : "Submit for Approval"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Purchase Request</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Reason for rejection *</Label>
            <Textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Explain why this PR is being rejected…" className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectPR} disabled={rejectSaving}>{rejectSaving ? "Rejecting…" : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LandlordLayout>
  );
}
