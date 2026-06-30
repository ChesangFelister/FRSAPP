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
import { Plus, Trash2 } from "lucide-react";

interface Provider { id: string; name: string; contact: string | null; phone: string | null; email: string | null; rating: number; active: boolean }
interface Service { id: string; property_id: string; provider_id: string | null; schedule: string; monthly_fee: number; active: boolean }
interface Property { id: string; name: string }
interface Collection { id: string; service_id: string; collected_on: string; status: string; notes: string | null }

export default function Waste() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [provDlg, setProvDlg] = useState(false);
  const [svcDlg, setSvcDlg] = useState(false);
  const [colDlg, setColDlg] = useState(false);

  const [pForm, setPForm] = useState({ name: "", contact: "", phone: "", email: "", notes: "" });
  const [sForm, setSForm] = useState({ property_id: "", provider_id: "none", schedule: "weekly", monthly_fee: "0" });
  const [cForm, setCForm] = useState({ service_id: "", status: "completed", notes: "" });

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: pr }, { data: svc }, { data: col }, { data: prop }] = await Promise.all([
      (supabase as any).from("waste_providers").select("*").eq("owner_id", user.id).order("created_at"),
      (supabase as any).from("waste_services").select("*").eq("owner_id", user.id).order("created_at"),
      (supabase as any).from("waste_collections").select("*").eq("owner_id", user.id).order("collected_on", { ascending: false }).limit(100),
      supabase.from("properties").select("id,name").eq("owner_id", user.id),
    ]);
    setProviders((pr as Provider[]) ?? []);
    setServices((svc as Service[]) ?? []);
    setCollections((col as Collection[]) ?? []);
    setProperties((prop as Property[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const saveProvider = async () => {
    if (!user || !pForm.name) return toast.error("Name required");
    const { error } = await (supabase as any).from("waste_providers").insert({ owner_id: user.id, ...pForm });
    if (error) return toast.error(error.message);
    toast.success("Provider added"); setProvDlg(false); setPForm({ name: "", contact: "", phone: "", email: "", notes: "" }); refresh();
  };
  const saveService = async () => {
    if (!user || !sForm.property_id) return toast.error("Property required");
    const { error } = await (supabase as any).from("waste_services").insert({
      owner_id: user.id,
      property_id: sForm.property_id,
      provider_id: sForm.provider_id === "none" ? null : sForm.provider_id,
      schedule: sForm.schedule,
      monthly_fee: Number(sForm.monthly_fee) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Service added"); setSvcDlg(false); refresh();
  };
  const saveCollection = async () => {
    if (!user || !cForm.service_id) return toast.error("Service required");
    const { error } = await (supabase as any).from("waste_collections").insert({ owner_id: user.id, ...cForm });
    if (error) return toast.error(error.message);
    toast.success("Collection logged"); setColDlg(false); refresh();
  };
  const generateMonthlyBills = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any).rpc("ensure_current_month_waste_for_owner", { _owner_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(`Generated ${data ?? 0} waste bills for this month`);
  };

  return (
    <LandlordLayout
      title="Waste Management"
      action={<Button size="sm" onClick={generateMonthlyBills}>Generate monthly bills</Button>}
    >
      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <Tabs defaultValue="services" className="space-y-6">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <div className="flex justify-end mb-3">
              <Dialog open={svcDlg} onOpenChange={setSvcDlg}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New service</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add waste service</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Property</Label>
                      <Select value={sForm.property_id} onValueChange={(v) => setSForm({ ...sForm, property_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Property" /></SelectTrigger>
                        <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Provider</Label>
                      <Select value={sForm.provider_id} onValueChange={(v) => setSForm({ ...sForm, provider_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Schedule</Label><Input value={sForm.schedule} onChange={(e) => setSForm({ ...sForm, schedule: e.target.value })} placeholder="weekly / mon,thu" /></div>
                      <div><Label>Monthly fee (KSh)</Label><Input type="number" value={sForm.monthly_fee} onChange={(e) => setSForm({ ...sForm, monthly_fee: e.target.value })} /></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveService}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Provider</TableHead><TableHead>Schedule</TableHead><TableHead className="text-right">Monthly fee</TableHead></TableRow></TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{properties.find((p) => p.id === s.property_id)?.name ?? "—"}</TableCell>
                      <TableCell>{providers.find((p) => p.id === s.provider_id)?.name ?? "—"}</TableCell>
                      <TableCell>{s.schedule}</TableCell>
                      <TableCell className="text-right">{formatKsh(s.monthly_fee)}</TableCell>
                    </TableRow>
                  ))}
                  {services.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No services configured.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="providers">
            <div className="flex justify-end mb-3">
              <Dialog open={provDlg} onOpenChange={setProvDlg}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New provider</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add provider</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Phone</Label><Input value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} /></div>
                      <div><Label>Email</Label><Input value={pForm.email} onChange={(e) => setPForm({ ...pForm, email: e.target.value })} /></div>
                    </div>
                    <div><Label>Contact person</Label><Input value={pForm.contact} onChange={(e) => setPForm({ ...pForm, contact: e.target.value })} /></div>
                    <div><Label>Notes</Label><Textarea value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveProvider}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Rating</TableHead></TableRow></TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.phone}</TableCell><TableCell>{p.email}</TableCell><TableCell className="text-right">{Number(p.rating).toFixed(1)}</TableCell></TableRow>
                  ))}
                  {providers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No providers.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="collections">
            <div className="flex justify-end mb-3">
              <Dialog open={colDlg} onOpenChange={setColDlg}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Log collection</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log waste collection</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Service</Label>
                      <Select value={cForm.service_id} onValueChange={(v) => setCForm({ ...cForm, service_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Service" /></SelectTrigger>
                        <SelectContent>
                          {services.map((s) => <SelectItem key={s.id} value={s.id}>{properties.find((p) => p.id === s.property_id)?.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Status</Label>
                      <Select value={cForm.status} onValueChange={(v) => setCForm({ ...cForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="missed">Missed</SelectItem>
                          <SelectItem value="rescheduled">Rescheduled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Notes</Label><Textarea value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={saveCollection}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {collections.map((c) => {
                    const s = services.find((x) => x.id === c.service_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{c.collected_on}</TableCell>
                        <TableCell>{properties.find((p) => p.id === s?.property_id)?.name ?? "—"}</TableCell>
                        <TableCell className="capitalize">{c.status}</TableCell>
                        <TableCell className="text-muted-foreground">{c.notes}</TableCell>
                      </TableRow>
                    );
                  })}
                  {collections.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No collections logged.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </LandlordLayout>
  );
}
