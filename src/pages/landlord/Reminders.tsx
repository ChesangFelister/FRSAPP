import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, differenceInCalendarDays } from "date-fns";
import { CalendarClock, Plus, Trash2, Bell, BellRing, BellOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LandlordLayout from "@/components/landlord/LandlordLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  notes?: string;
  date: string; // ISO date (yyyy-MM-dd)
  createdAt: string;
}

const storageKey = (uid: string) => `frs_reminders_${uid}`;
const notifiedKey = (uid: string) => `frs_reminders_notified_${uid}`;

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(storageKey(user.id));
    if (raw) {
      try { setReminders(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [user]);

  const persist = (next: Reminder[]) => {
    setReminders(next);
    if (user) localStorage.setItem(storageKey(user.id), JSON.stringify(next));
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Notifications not supported in this browser");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        toast.success("Notifications enabled", { description: "You'll be alerted for upcoming reminders." });
        new Notification("Flashrentsolution", { body: "Reminder notifications are now active." });
      } else {
        toast.error("Notifications blocked", { description: "Enable them in your browser settings." });
      }
    } catch {
      toast.error("Could not enable notifications");
    }
  };

  // Check & fire notifications for reminders due today or tomorrow
  useEffect(() => {
    if (!user || notifPermission !== "granted" || reminders.length === 0) return;

    const fireNotifications = () => {
      const raw = localStorage.getItem(notifiedKey(user.id));
      const notified = new Set<string>(raw ? JSON.parse(raw) : []);
      const today = new Date(); today.setHours(0, 0, 0, 0);

      reminders.forEach((r) => {
        const d = new Date(r.date);
        const diff = differenceInCalendarDays(d, today);
        if (diff !== 0 && diff !== 1) return;
        const key = `${r.id}:${diff}`;
        if (notified.has(key)) return;
        const when = diff === 0 ? "today" : "tomorrow";
        try {
          new Notification(`Reminder ${when}: ${r.title}`, {
            body: r.notes || `${format(d, "PPP")}`,
            tag: key,
          });
          notified.add(key);
        } catch { /* ignore */ }
      });

      localStorage.setItem(notifiedKey(user.id), JSON.stringify([...notified]));
    };

    fireNotifications();
    const id = window.setInterval(fireNotifications, 60 * 60 * 1000); // hourly
    return () => window.clearInterval(id);
  }, [user, reminders, notifPermission]);

  const dayHasReminder = useMemo(() => {
    const set = new Set(reminders.map(r => r.date));
    return (d: Date) => set.has(format(d, "yyyy-MM-dd"));
  }, [reminders]);

  const forSelected = reminders
    .filter(r => selected && isSameDay(new Date(r.date), selected))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const upcoming = reminders
    .filter(r => new Date(r.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const addReminder = () => {
    if (!selected || !title.trim()) {
      toast.error("Add a title and pick a date");
      return;
    }
    const next: Reminder = {
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      date: format(selected, "yyyy-MM-dd"),
      createdAt: new Date().toISOString(),
    };
    persist([...reminders, next]);
    setTitle(""); setNotes(""); setOpen(false);
    toast.success("Reminder added", { description: `${next.title} · ${format(selected, "PPP")}` });
  };

  const remove = (id: string) => {
    persist(reminders.filter(r => r.id !== id));
    toast.success("Reminder removed");
  };

  return (
    <LandlordLayout
      title="Reminders"
      action={
        <div className="flex items-center gap-2">
          {notifPermission === "granted" ? (
            <Button variant="outline" disabled className="gap-2">
              <BellRing className="h-4 w-4 text-accent" /> Alerts on
            </Button>
          ) : (
            <Button variant="outline" onClick={enableNotifications} className="gap-2">
              <BellOff className="h-4 w-4" /> Enable alerts
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> New reminder</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="r-title">Title</Label>
                  <Input id="r-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Rent collection, inspection…" />
                </div>
                <div>
                  <Label htmlFor="r-notes">Notes (optional)</Label>
                  <Textarea id="r-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Date: <span className="text-foreground">{selected ? format(selected, "PPP") : "—"}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addReminder}>Save reminder</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 text-accent text-xs uppercase tracking-[0.25em]">
          <span className="gold-rule" /><span>Stay on schedule</span>
        </div>
        <h2 className="font-serif text-3xl md:text-4xl text-balance">Track key dates, inspections and updates.</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="bg-card border border-border p-4">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            className={cn("p-3 pointer-events-auto")}
            modifiers={{ hasReminder: (d) => dayHasReminder(d) }}
            modifiersClassNames={{ hasReminder: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-accent" }}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-xl flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent" strokeWidth={1.75} />
                {selected ? format(selected, "PPP") : "Select a date"}
              </h3>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{forSelected.length} item{forSelected.length !== 1 ? "s" : ""}</span>
            </div>
            {forSelected.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                No reminders on this date. Click "New reminder" to add one.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {forSelected.map(r => (
                  <li key={r.id} className="flex items-start gap-4 p-4">
                    <Bell className="h-4 w-4 text-accent mt-1" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{r.title}</div>
                      {r.notes && <div className="text-sm text-muted-foreground mt-1">{r.notes}</div>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete reminder">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-serif text-xl">Upcoming</h3>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No upcoming reminders.</div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map(r => (
                  <li key={r.id} className="flex items-center gap-4 p-4">
                    <div className="w-24 text-xs uppercase tracking-widest text-accent">{format(new Date(r.date), "MMM d")}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.title}</div>
                      {r.notes && <div className="text-sm text-muted-foreground truncate">{r.notes}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </LandlordLayout>
  );
}
