import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, FileText, Wallet, Moon, Sun, LogOut,
  Calendar, ClipboardCheck, Car, Landmark, BarChart3, Calculator, Menu, Settings, Upload, Star, Bell, MessageSquare,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, moduleForPath, type ModuleKey } from "@/lib/permissions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { Badge } from "@/components/ui/badge";


type Item = { to: string; label: string; icon: any; module: ModuleKey };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Início", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  ]},
  { label: "Comercial", items: [
    { to: "/clientes", label: "Clientes · CRM", icon: Users, module: "cadastros" },
    { to: "/mensagens", label: "Mensagens", icon: MessageSquare, module: "mensagens" },

    { to: "/roteiros-personalizados", label: "Roteiros Personalizados", icon: FileText, module: "propostas" },
    { to: "/orcamento", label: "Proposta/Orçamento", icon: Calculator, module: "propostas" },
  ]},

  { label: "Operação", items: [
    { to: "/voucher", label: "Voucher", icon: FileText, module: "voucher" },
    { to: "/oc", label: "Ordens de Serviço", icon: ClipboardCheck, module: "oc" },
    { to: "/agenda", label: "Agenda", icon: Calendar, module: "agenda" },
    { to: "/relatorio-diario", label: "Relatório Diário", icon: BarChart3, module: "agenda" },
  ]},
  { label: "Logística", items: [
    { to: "/roteiro", label: "Roteiro do Dia", icon: Calendar, module: "operacao" },
    { to: "/servicos-privados", label: "Serviços Privados", icon: ClipboardCheck, module: "operacao" },
    { to: "/tvde", label: "TVDE (Uber/Bolt)", icon: Car, module: "tvde" },
  ]},
  { label: "Financeiro", items: [
    { to: "/financeiro", label: "Faturas", icon: Wallet, module: "financeiro" },
    { to: "/conta-corrente", label: "Conta Corrente e Movimentos", icon: Landmark, module: "conta_corrente" },
    { to: "/custos-fixos", label: "Custos Fixos", icon: Calculator, module: "conta_corrente" },
    { to: "/comissoes", label: "Comissões Semanais", icon: BarChart3, module: "conta_corrente" },
    { to: "/fechamento", label: "Fechamento Mensal", icon: Calculator, module: "fechamento" },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3, module: "relatorios" },
  ]},
  { label: "Pós-Venda", items: [
    { to: "/pos-venda", label: "Satisfação", icon: Star, module: "pos_venda" },
  ]},
  { label: "Administração", items: [
    { to: "/cadastros", label: "Cadastros", icon: Users, module: "cadastros" },
    { to: "/alertas", label: "Alertas & Vencimentos", icon: Bell, module: "alertas" },
    { to: "/importar", label: "Importar CSV", icon: Upload, module: "importar" },
    { to: "/configuracoes", label: "Configurações", icon: Settings, module: "configuracoes" },
  ]},
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { can, loading: permsLoading, error: permsError } = usePermissions();
  const loc = useLocation();
  const { hasUnsavedChanges } = useUnsavedChanges();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      if (!confirm("Tem alterações não guardadas que serão perdidas. Deseja sair sem guardar?")) {
        e.preventDefault();
        return;
      }
    }
    setMobileOpen(false);
  };


  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.module)) }))
    .filter((g) => g.items.length > 0);

  const currentModule = moduleForPath(loc.pathname);
  const blocked = !permsLoading && (!!permsError || (!!currentModule && !can(currentModule)));

  const firstAllowed = visibleGroups[0]?.items[0]?.to;

  const Denied = (
    <div className="p-6 sm:p-10">
      <div className="max-w-md mx-auto text-center border border-border rounded-lg p-8 bg-card">
        <h2 className="text-lg font-semibold">Sem permissão</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O seu perfil não tem acesso a esta página. Fale com um administrador se precisar deste módulo.
        </p>
        {firstAllowed && (
          <Link to={firstAllowed} className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Ir para uma página permitida
          </Link>
        )}
      </div>
    </div>
  );

  const Nav = (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {visibleGroups.map((g) => (
        <div key={g.label}>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-1">{g.label}</div>
          <div className="space-y-0.5">
            {g.items.map((n) => {
              const active = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} onClick={handleLinkClick}
                  className={`flex items-center gap-3 px-3 py-2.5 md:py-2 min-h-11 md:min-h-0 rounded-md text-sm transition-colors ${
                    active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                           : "hover:bg-sidebar-accent text-sidebar-foreground/90"
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{n.label}</span>
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
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[85vw] max-w-xs z-50 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-y-auto">
            {SideContent}
          </aside>
        </>
      )}

      <main className="flex-1 overflow-auto min-w-0">
        <div className="hidden md:flex items-center justify-end gap-2 border-b border-border px-6 py-2 bg-background/70 backdrop-blur">
          <GlobalSearch />
        </div>
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border px-3 py-2 bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-sidebar-foreground h-11 w-11 shrink-0" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
            <Logo className="h-8 w-8 shrink-0" />
            <span className="font-bold text-sidebar-primary truncate">MTOUR</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <GlobalSearch />
            <Button variant="ghost" size="icon" onClick={toggle} className="text-sidebar-foreground h-11 w-11" aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-foreground h-11 w-11" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {permsLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">A validar permissões…</div>
        ) : blocked ? Denied : children}
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
