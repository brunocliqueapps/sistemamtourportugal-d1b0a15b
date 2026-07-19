import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, FileText, Wallet, ClipboardList, Moon, Sun, LogOut,
  Calendar, ClipboardCheck, Car, Landmark, BarChart3, Calculator, Search, Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type Item = { to: string; label: string; icon: any };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Início", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/agenda", label: "Agenda", icon: Calendar },
  ]},
  { label: "Comercial", items: [
    { to: "/crm", label: "CRM · Leads", icon: Users },
    { to: "/propostas", label: "Propostas", icon: FileText },
  ]},
  { label: "Operação", items: [
    { to: "/oc", label: "Ordens de Serviço", icon: ClipboardCheck },
    { to: "/operacao", label: "Turnos Motorista", icon: ClipboardList },
    { to: "/tvde", label: "TVDE (Uber/Bolt)", icon: Car },
  ]},
  { label: "Financeiro", items: [
    { to: "/financeiro", label: "Faturas & Movimentos", icon: Wallet },
    { to: "/conta-corrente", label: "Conta Corrente", icon: Landmark },
    { to: "/fechamento", label: "Fechamento Mensal", icon: Calculator },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  ]},
  { label: "Administração", items: [
    { to: "/cadastros", label: "Cadastros", icon: Users },
  ]},
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Nav = (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-1">{g.label}</div>
          <div className="space-y-0.5">
            {g.items.map((n) => {
              const active = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                           : "hover:bg-sidebar-accent text-sidebar-foreground/90"
                  }`}>
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const SideContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <Logo className="h-10 w-10" />
        <div>
          <div className="font-bold tracking-wide text-sidebar-primary">MTOUR</div>
          <div className="text-xs text-sidebar-foreground/70 -mt-0.5">PORTUGAL</div>
        </div>
      </div>
      {Nav}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="text-xs text-sidebar-foreground/70 px-2 truncate">{user?.email}</div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={toggle} className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {SideContent}
      </aside>

      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-50 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            {SideContent}
          </aside>
        </>
      )}

      <main className="flex-1 overflow-auto min-w-0">
        <div className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)} className="text-sidebar-foreground"><Menu className="h-5 w-5" /></Button>
            <Logo className="h-8 w-8" />
            <span className="font-bold text-sidebar-primary">MTOUR</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={toggle} className="text-sidebar-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
