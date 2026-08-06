import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { ThemeProvider } from "../lib/theme";
import { AppShell } from "../components/layout/AppShell";
import { Toaster } from "../components/ui/sonner";
import { UnsavedChangesProvider } from "../lib/unsaved-changes-context";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ir para Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Erro ao carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mtour Portugal — CRM Operacional" },
      { name: "description", content: "Plataforma completa Mtour Portugal: comercial, operação, frota, financeiro e pós-venda." },
      { property: "og:title", content: "Mtour Portugal — CRM Operacional" },
      { property: "og:description", content: "Plataforma completa Mtour Portugal: comercial, operação, frota, financeiro e pós-venda." },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#09223d" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Mtour CRM" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Mtour Portugal — CRM Operacional" },
      { name: "twitter:description", content: "Plataforma completa Mtour Portugal: comercial, operação, frota, financeiro e pós-venda." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/8SfHMU0mUHc6TbNobC8zfJOjrQ12/social-images/social-1783030679105-5_20260612_105741_0001_(1).webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/8SfHMU0mUHc6TbNobC8zfJOjrQ12/social-images/social-1783030679105-5_20260612_105741_0001_(1).webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const isAuthRoute = loc.pathname === "/" || loc.pathname === "/registro";
  const isPublicRoute = loc.pathname.startsWith("/pesquisa/");

  useEffect(() => {
    if (isPublicRoute) return;
    if (loading) return;
    if (!user && !isAuthRoute) nav({ to: "/" });
    if (user && isAuthRoute) nav({ to: "/dashboard" });
  }, [user, loading, isAuthRoute, nav]);

  if (isPublicRoute) return <>{children}</>;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">A carregar…</div>;
  }
  if (!user) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UnsavedChangesProvider>
            <AuthGate>
              <Outlet />
            </AuthGate>
            <Toaster />
          </UnsavedChangesProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
