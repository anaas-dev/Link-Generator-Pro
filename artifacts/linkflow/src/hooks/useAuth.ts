import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

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

export function useAuth() {
  return useQuery<AuthUser | null>({
    queryKey: ["auth/me"],
    queryFn: async () => {
      try {
        return await apiFetch("/auth/me") as AuthUser;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<AuthUser, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) =>
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    onSuccess: (user) => {
      qc.setQueryData(["auth/me"], user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation<AuthUser, Error, { name: string; email: string; password: string }>({
    mutationFn: ({ name, email, password }) =>
      apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
    onSuccess: (user) => {
      qc.setQueryData(["auth/me"], user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["auth/me"], null);
      qc.clear();
    },
  });
}
