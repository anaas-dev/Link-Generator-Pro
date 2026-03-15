import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Megaphone, Link as LinkIcon, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth, useLogout } from "@/hooks/useAuth";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: user } = useAuth();
  const logout = useLogout();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Campaigns", href: "/campaigns", icon: Megaphone },
    { name: "Links", href: "/links", icon: LinkIcon },
  ];

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0d1b2e] text-white p-4 md:p-6 border-none">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
          <LinkIcon className="w-5 h-5 text-[#4f8ef7]" strokeWidth={3} />
        </div>
        <span className="text-2xl font-display font-bold tracking-tight text-white">
          Yas-Links
        </span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium cursor-pointer",
                isActive
                  ? "bg-[#1e3a5f] text-white"
                  : "text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[#4f8ef7] rounded-r-full" />
              )}
              <item.icon className={cn("w-5 h-5", isActive ? "text-[#4f8ef7]" : "text-white/40 group-hover:text-white/70")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-none">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-sm text-white">{initials}</span>
          </div>
          <div className="flex flex-col overflow-hidden flex-1">
            <span className="font-medium text-sm text-white truncate">{user?.name || "Loading..."}</span>
            <span className="text-xs text-white/50 truncate">{user?.email || ""}</span>
          </div>
          <button
            onClick={() => logout.mutate()}
            title="Sign out"
            className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="px-2 text-center">
          <span className="text-[11px] text-white/25 tracking-wide">by Soudaysse</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex w-full">
      <aside className="hidden md:block w-[280px] flex-shrink-0 fixed h-full z-20">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d1b2e] z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
            <LinkIcon className="w-4 h-4 text-[#4f8ef7]" strokeWidth={3} />
          </div>
          <span className="text-xl font-display font-bold text-white">Yas-Links</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            className="fixed inset-0 z-20 md:hidden bg-[#0d1b2e] pt-16"
          >
            <SidebarContent />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 md:ml-[280px] flex flex-col min-h-screen pt-16 md:pt-0">
        <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
