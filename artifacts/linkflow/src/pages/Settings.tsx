import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data;
}

interface TeamUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function Settings() {
  const { data: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", isAdmin: false });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<TeamUser[]>({
    queryKey: ["admin/users"],
    queryFn: () => apiFetch("/admin/users"),
    enabled: !!currentUser?.isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/users"] });
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", isAdmin: false });
      toast({ title: "Account created successfully." });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/users"] });
      setDeleteConfirmId(null);
      toast({ title: "User deleted." });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (!currentUser?.isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <ShieldCheck className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Admin Access Required</h2>
          <p className="text-muted-foreground">Only administrators can access this section.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Team Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage team member accounts and access.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="font-bold text-foreground">Team Members</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{users.length} account{users.length !== 1 ? "s" : ""}</p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-[#4f8ef7] hover:bg-[#3a7ae8] text-white rounded-xl gap-2 px-4"
            >
              <Plus className="w-4 h-4" /> Add Member
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#4f8ef7] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No users found.</div>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#f4f6fb] flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-sm text-[#4f8ef7]">
                        {user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{user.name}</span>
                        {user.isAdmin && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4f8ef7] bg-[#4f8ef7]/10 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                        {user.id === currentUser.id && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                  {user.id !== currentUser.id && (
                    <button
                      onClick={() => setDeleteConfirmId(user.id)}
                      className="p-2 text-muted-foreground hover:text-[#ef4444] hover:bg-[#ef4444]/5 rounded-lg transition-colors cursor-pointer"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-xl font-display font-bold">New Team Member</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            className="px-6 py-5 space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Full Name</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                required
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                required
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                id="isAdmin"
                type="checkbox"
                checked={form.isAdmin}
                onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                className="w-4 h-4 accent-[#4f8ef7] cursor-pointer"
              />
              <label htmlFor="isAdmin" className="text-sm text-foreground cursor-pointer select-none">
                Grant administrator access
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 bg-[#4f8ef7] hover:bg-[#3a7ae8] text-white rounded-xl"
              >
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-bold">Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm mt-2">
            This will permanently delete this user account. They will no longer be able to log in.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
