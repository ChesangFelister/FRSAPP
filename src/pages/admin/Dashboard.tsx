import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users, Building2, Wrench, Receipt, ShieldCheck, LogOut, Trash2, Plus, X, Pencil,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type ManagedUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ["admin", "landlord", "caretaker", "tenant", "service_provider"];

const ADMIN_NAV_ITEMS = [
  { value: "users", label: "Users & roles", icon: Users },
  { value: "properties", label: "Properties", icon: Building2 },
  { value: "tenants", label: "Tenants", icon: Users },
  { value: "payments", label: "Payments", icon: Receipt },
  { value: "issues", label: "Issues", icon: Wrench },
] as const;

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<(typeof ADMIN_NAV_ITEMS)[number]["value"]>("users");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "record" | "user";
    table?: string;
    id: string;
    label: string;
  } | null>(null);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editRoles, setEditRoles] = useState<Set<AppRole>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);
  const [editProperty, setEditProperty] = useState<any | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState<any>({});
  const [savingProperty, setSavingProperty] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u }, props, ts, pays, iss] = await Promise.all([
      supabase.functions.invoke("admin-users", { body: { action: "list" } }),
      supabase.from("properties").select("id, name, address, city, status, owner_id, monthly_rent_ksh, units_count, created_at").order("created_at", { ascending: false }),
      supabase.from("tenants").select("id, full_name, email, phone, status, monthly_rent_ksh, unit_label, owner_id, property_id, created_at").order("created_at", { ascending: false }),
      supabase.from("rent_payments").select("id, owner_id, tenant_id, period_month, period_year, amount_due, amount_paid, status, due_date, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("maintenance_issues").select("id, title, status, priority, owner_id, tenant_id, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    setUsers((u as any)?.users ?? []);
    setProperties(props.data ?? []);
    setTenants(ts.data ?? []);
    setPayments(pays.data ?? []);
    setIssues(iss.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const ownerMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.full_name || u.email || "Unknown"])),
    [users]
  );
  const tenantMap = useMemo(
    () => Object.fromEntries(tenants.map((t) => [t.id, t.full_name || "Unknown"])),
    [tenants]
  );
  const propertyMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p.name || "Unknown"])),
    [properties]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      u.roles.some((r) => r.includes(q))
    );
  }, [users, query]);

  const addRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.functions.invoke("admin-users", { body: { action: "addRole", userId, role } });
    if (error) return toast.error(error.message);
    toast.success(`Added ${role}`);
    loadAll();
  };
  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.functions.invoke("admin-users", { body: { action: "removeRole", userId, role } });
    if (error) return toast.error(error.message);
    toast.success(`Removed ${role}`);
    loadAll();
  };

  const openEdit = (u: ManagedUser) => {
    setEditUser(u);
    setEditRoles(new Set(u.roles));
  };
  const toggleEditRole = (r: AppRole) => {
    setEditRoles((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  };
  const saveEditRoles = async () => {
    if (!editUser) return;
    setSavingRoles(true);
    const current = new Set(editUser.roles);
    const toAdd = [...editRoles].filter((r) => !current.has(r));
    const toRemove = [...current].filter((r) => !editRoles.has(r));
    try {
      for (const role of toAdd) {
        const { error } = await supabase.functions.invoke("admin-users", { body: { action: "addRole", userId: editUser.id, role } });
        if (error) throw error;
      }
      for (const role of toRemove) {
        const { error } = await supabase.functions.invoke("admin-users", { body: { action: "removeRole", userId: editUser.id, role } });
        if (error) throw error;
      }
      toast.success("Roles updated");
      setEditUser(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update roles");
    } finally {
      setSavingRoles(false);
    }
  };

  const openEditProperty = (prop: any) => {
    setEditProperty(prop);
    setEditPropertyForm({
      name: prop.name,
      address: prop.address,
      city: prop.city,
      property_type: prop.property_type || "apartment",
      units_count: prop.units_count || 1,
      monthly_rent_ksh: prop.monthly_rent_ksh || 0,
      status: prop.status || "active",
      description: prop.description || "",
    });
  };

  const saveEditProperty = async () => {
    if (!editProperty) return;
    setSavingProperty(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update(editPropertyForm)
        .eq("id", editProperty.id);
      if (error) throw error;
      toast.success("Property updated");
      setEditProperty(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update property");
    } finally {
      setSavingProperty(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "user") {
      const { error } = await supabase.functions.invoke("admin-users", { body: { action: "deleteUser", userId: pendingDelete.id } });
      if (error) toast.error(error.message);
      else { toast.success("User deleted"); loadAll(); }
    } else {
      const { error } = await supabase.from(pendingDelete.table as any).delete().eq("id", pendingDelete.id);
      if (error) toast.error(error.message);
      else { toast.success("Deleted"); loadAll(); }
    }
    setPendingDelete(null);
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const counts = {
    users: users.length,
    properties: properties.length,
    tenants: tenants.length,
    issues: issues.filter((i) => i.status !== "resolved").length,
    payments: payments.length,
  };

  return (
    <SidebarProvider className="min-h-screen bg-subtle">
      <Sidebar side="left" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-base font-semibold text-muted-foreground">Admin Console</SidebarGroupLabel>
            <SidebarMenu>
              {ADMIN_NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                <SidebarMenuItem key={value}>
                  <SidebarMenuButton
                    isActive={activeTab === value}
                    onClick={() => setActiveTab(value)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="mt-auto border-t border-sidebar-border">
          <div className="flex flex-col gap-2 p-2 text-sm text-muted-foreground">
            <span className="font-medium">Signed in as</span>
            <span className="truncate">{user?.email ?? "Unknown"}</span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex-1">
        <header className="bg-primary text-primary-foreground">
          <div className="container-wide flex items-center h-16 gap-4">
            <SidebarTrigger className="block md:hidden" />
            <Link to="/" className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <span className="font-serif text-xl">Admin Console</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-primary-foreground/60 hidden sm:inline">{user?.email}</span>
              <Button variant="outline-light" size="sm" onClick={handleSignOut}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="container-wide py-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Platform overview</h1>
          <p className="text-muted-foreground text-sm">Full visibility across every account, property, payment, and issue.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat icon={Users} label="Users" value={counts.users} />
          <Stat icon={Building2} label="Properties" value={counts.properties} />
          <Stat icon={Users} label="Tenants" value={counts.tenants} />
          <Stat icon={Receipt} label="Payments" value={counts.payments} />
          <Stat icon={Wrench} label="Open issues" value={counts.issues} />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users & roles</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="font-serif">All users ({users.length})</CardTitle>
                <Input
                  placeholder="Search email, name, role…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Add role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-[90px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.full_name || u.email}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                              {u.roles.map((r) => (
                                <Badge key={r} variant="secondary" className="gap-1 pr-1">
                                  {r}
                                  <button
                                    onClick={() => removeRole(u.id, r)}
                                    className="hover:text-destructive ml-0.5"
                                    aria-label={`Remove ${r}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select onValueChange={(role) => addRole(u.id, role as AppRole)}>
                              <SelectTrigger className="w-[160px] h-8">
                                <SelectValue placeholder="Assign role" />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                                  <SelectItem key={r} value={r}>
                                    <Plus className="h-3 w-3 inline mr-1" />{r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(u.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label="Edit roles">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPendingDelete({ kind: "user", id: u.id, label: u.email ?? u.full_name ?? "user" })}
                                aria-label="Delete user"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="properties" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="font-serif">All properties ({properties.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {properties.length === 0 ? <p className="text-sm text-muted-foreground">No properties.</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Rent (KES)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{ownerMap[r.owner_id] ?? "—"}</TableCell>
                          <TableCell>{r.address}, {r.city}</TableCell>
                          <TableCell>{r.units_count}</TableCell>
                          <TableCell>{r.monthly_rent_ksh}</TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEditProperty(r)} aria-label="Edit property">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPendingDelete({ kind: "record", table: "properties", id: r.id, label: r.name })}
                                aria-label="Delete property"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants" className="mt-6">
            <DataCard title="All tenants" rows={tenants} columns={[
              { k: "full_name", h: "Name", render: (r) => <span className="font-medium">{r.full_name}</span> },
              { k: "email", h: "Email" },
              { k: "property_id", h: "Property", render: (r) => propertyMap[r.property_id] ?? "—" },
              { k: "unit_label", h: "Unit" },
              { k: "monthly_rent_ksh", h: "Rent (KES)" },
              { k: "status", h: "Status" },
              { k: "owner_id", h: "Owner", render: (r) => ownerMap[r.owner_id] ?? "—" },
            ]} onDelete={(r) => setPendingDelete({ kind: "record", table: "tenants", id: r.id, label: r.full_name })} />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <DataCard title="All rent payments" rows={payments} columns={[
              { k: "tenant_id", h: "Tenant", render: (r) => tenantMap[r.tenant_id] ?? "—" },
              { k: "property_id", h: "Property", render: (r) => propertyMap[r.property_id] ?? "—" },
              { k: "owner_id", h: "Owner", render: (r) => ownerMap[r.owner_id] ?? "—" },
              { k: "period", h: "Period", render: (r) => `${r.period_month}/${r.period_year}` },
              { k: "amount_due", h: "Due" },
              { k: "amount_paid", h: "Paid" },
              { k: "due_date", h: "Due date" },
              { k: "status", h: "Status" },
            ]} onDelete={(r) => setPendingDelete({ kind: "record", table: "rent_payments", id: r.id, label: `Payment ${r.id.slice(0, 8)}` })} />
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <DataCard title="All maintenance issues" rows={issues} columns={[
              { k: "title", h: "Title" },
              { k: "tenant_id", h: "Tenant", render: (r) => tenantMap[r.tenant_id] ?? "—" },
              { k: "property_id", h: "Property", render: (r) => propertyMap[r.property_id] ?? "—" },
              { k: "priority", h: "Priority" },
              { k: "status", h: "Status" },
              { k: "created_at", h: "Reported", render: (r) => format(new Date(r.created_at), "MMM d, yyyy") },
            ]} onDelete={(r) => setPendingDelete({ kind: "record", table: "maintenance_issues", id: r.id, label: r.title })} />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.label} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>
              {editUser?.full_name || editUser?.email} — select all roles this user should have.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={editRoles.has(r)}
                  onCheckedChange={() => toggleEditRole(r)}
                  id={`role-${r}`}
                />
                <Label htmlFor={`role-${r}`} className="capitalize cursor-pointer">
                  {r.replace("_", " ")}
                </Label>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)} disabled={savingRoles}>Cancel</Button>
            <Button onClick={saveEditRoles} disabled={savingRoles}>
              {savingRoles ? "Saving…" : "Save roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProperty} onOpenChange={(o) => !o && setEditProperty(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit property</DialogTitle>
            <DialogDescription>
              Update property details for {editProperty?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prop-name">Property name *</Label>
                <Input
                  id="prop-name"
                  value={editPropertyForm.name || ""}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, name: e.target.value })}
                  placeholder="e.g., Westlands Apartments"
                />
              </div>
              <div>
                <Label htmlFor="prop-type">Type</Label>
                <select
                  id="prop-type"
                  value={editPropertyForm.property_type || "apartment"}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, property_type: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                >
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="commercial">Commercial</option>
                  <option value="land">Land</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="prop-address">Address *</Label>
                <Input
                  id="prop-address"
                  value={editPropertyForm.address || ""}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="prop-city">City *</Label>
                <Input
                  id="prop-city"
                  value={editPropertyForm.city || ""}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="prop-units">Units count</Label>
                <Input
                  id="prop-units"
                  type="number"
                  value={editPropertyForm.units_count || 1}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, units_count: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="prop-rent">Monthly rent (KES)</Label>
                <Input
                  id="prop-rent"
                  type="number"
                  value={editPropertyForm.monthly_rent_ksh || 0}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, monthly_rent_ksh: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="prop-status">Status</Label>
                <select
                  id="prop-status"
                  value={editPropertyForm.status || "active"}
                  onChange={(e) => setEditPropertyForm({ ...editPropertyForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="prop-description">Description</Label>
              <textarea
                id="prop-description"
                value={editPropertyForm.description || ""}
                onChange={(e) => setEditPropertyForm({ ...editPropertyForm, description: e.target.value })}
                placeholder="Property description"
                className="w-full px-3 py-2 border border-input rounded-md text-sm min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditProperty(null)} disabled={savingProperty}>Cancel</Button>
            <Button onClick={saveEditProperty} disabled={savingProperty}>
              {savingProperty ? "Saving…" : "Save property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  </SidebarProvider>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
        </div>
        <div className="font-serif text-3xl">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

type Col = { k: string; h: string; render?: (r: any) => React.ReactNode };

function DataCard({ title, rows, columns, onDelete }: { title: string; rows: any[]; columns: Col[]; onDelete: (r: any) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-serif">{title} ({rows.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No records.</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c.k}>{c.h}</TableHead>)}
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {columns.map((c) => (
                    <TableCell key={c.k}>{c.render ? c.render(r) : String(r[c.k] ?? "—")}</TableCell>
                  ))}
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(r)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
