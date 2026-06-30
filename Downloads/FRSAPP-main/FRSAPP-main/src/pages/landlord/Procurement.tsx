import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKsh } from "@/lib/currency";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Supplier { id: string; name: string; phone: string | null; email: string | null; rating: number; active: boolean }
interface Request { id: string; supplier_id: string | null; status: string; notes: string | null; total_estimate: number; created_at: string }

export default function Procurement() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [supDlg, setSupDlg] = useState(false);
  const [prDlg, setPrDlg] = useState(false);

  const [sForm, setSForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [rForm, setRForm] = useState({ supplier_id: "none", notes: "", total_estimate: "0" });

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      (supabase as any).from("suppliers").select("*").eq("owner_id", user.id).order("created_at"),
      (supabase as any).from("purchase_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setSuppliers((s as Supplier[]) ?? []);
    setRequests((r as Request[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const saveSupplier = async () => {
    if (!user || !sForm.name) return toast.error("Name required");
    const { error } = await (supabase as any).from("suppliers").insert({ owner_id: user.id, ...sForm });
    if (error) return toast.error(error.message);
    toast.success("Supplier added"); setSupDlg(false); refresh();
  };
  const saveRequest = async () => {
    if (!user) return;
    const { error } = await (supabase as any).from("purchase_requests").insert({
      owner_id: user.id, requester_id: user.id,
      supplier_id: rForm.supplier_id === "none" ? null : rForm.supplier_id,
      notes: rForm.notes || null, total_estimate: Number(rForm.total_estimate) || 0, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Purchase request created"); setPrDlg(false); refresh();
  };
  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = user?.id; }
    if (status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
    const { error } = await (supabase as any).from("purchase_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`); refresh();
  };

  return (
    <LandlordLayout title="Procurement">
      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests">Purchase requests</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="flex justify-end mb-3">
              <Dialog open={prDlg} onOpenChange={setPrDlg}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New request</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New purchase request</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Supplier</Label>
                      <Select value={rForm.supplier_id} onValueChange={(v) => setRForm({ ...rForm, supplier_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Estimated total (KSh)</Label><Input type="number" value={rForm.total_estimate} onChange={(e) => setRForm({ ...rForm, total_estimate: e.target.value })} /></div>
                    <div><Label>Notes / items</Label><Textarea value={rForm.notes} onChange={(e) => setRForm({ ...rForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveRequest}>Submit</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Estimate</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{suppliers.find((s) => s.id === r.supplier_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatKsh(r.total_estimate)}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {r.status === "pending" && <>
                          <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>Reject</Button>
                        </>}
                        {r.status === "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "fulfilled")}>Mark fulfilled</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No requests.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="suppliers">
            <div className="flex justify-end mb-3">
              <Dialog open={supDlg} onOpenChange={setSupDlg}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New supplier</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Phone</Label><Input value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} /></div>
                      <div><Label>Email</Label><Input value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} /></div>
                    </div>
                    <div><Label>Notes</Label><Textarea value={sForm.notes} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveSupplier}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Rating</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.phone}</TableCell><TableCell>{s.email}</TableCell><TableCell className="text-right">{Number(s.rating).toFixed(1)}</TableCell></TableRow>
                  ))}
                  {suppliers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No suppliers.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </LandlordLayout>
  );
}
