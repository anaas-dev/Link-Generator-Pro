import { useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@/hooks/useAuth";
import { Link as LinkIcon, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#0d1b2e] flex items-center justify-center shadow-lg">
              <LinkIcon className="w-5 h-5 text-[#4f8ef7]" strokeWidth={3} />
            </div>
            <span className="text-3xl font-display font-bold text-[#0d1b2e]">Yas-Links</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]/30 focus:border-[#4f8ef7] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-slate-200 bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]/30 focus:border-[#4f8ef7] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {login.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {login.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full h-11 bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white font-semibold rounded-xl shadow-[0_4px_12px_rgba(79,142,247,0.3)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {login.isPending ? "Signing in..." : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/register" className="text-[#4f8ef7] font-semibold hover:underline">
            Create one
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">by Soudaysse</p>
      </div>
    </div>
  );
}
