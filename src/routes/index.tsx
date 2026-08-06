import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/layout/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar | Mtour Portugal CRM" },
      { name: "description", content: "Acesso ao CRM operacional da Mtour Portugal." },
      { property: "og:title", content: "Mtour Portugal CRM" },
      { property: "og:description", content: "Acesso ao CRM operacional da Mtour Portugal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) toast.error(error); else toast.success("Bem-vindo!");
    } else if (mode === "signup") {
      const { error } = await signUp(email, password, name);
      if (error) toast.error(error); else toast.success("Conta criada — verifique o e-mail.");
    } else {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) toast.error(error.message); else toast.success("E-mail de recuperação enviado.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between p-12 gradient-navy text-white relative overflow-hidden">
        <div className="flex items-center gap-3">
          <Logo className="h-14 w-14" />
          <div>
            <div className="text-2xl font-bold tracking-wide text-gold">MTOUR</div>
            <div className="text-sm opacity-80 -mt-1">PORTUGAL</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight">
            Centralize <span className="text-gold">toda</span> a operação da sua agência.
          </h1>
          <p className="mt-4 text-white/70 max-w-md">
            Comercial, operação, frota, financeiro e pós-venda — do lead à indicação futura, num só lugar.
          </p>
        </div>
        <div className="text-xs opacity-60">mtourportugal.com</div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <Logo className="h-10 w-10" />
            <div>
              <div className="font-bold text-primary">MTOUR PORTUGAL</div>
              <div className="text-xs text-muted-foreground">CRM Operacional</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold">
            {mode === "signin" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "recover" && "Recuperar senha"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" && "Aceda ao painel Mtour Portugal."}
            {mode === "signup" && "Registe-se para começar."}
            {mode === "recover" && "Enviaremos o link para o seu e-mail."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "recover" && (
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full gradient-gold text-gold-foreground hover:opacity-90">
              {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          {mode !== "recover" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3-3C17.2 1.7 14.8.7 12 .7 7.4.7 3.5 3.4 1.6 7.3l3.5 2.7C6.1 7 8.8 5 12 5z"/>
                  <path fill="#4285F4" d="M23.3 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4c-.3 1.5-1.1 2.7-2.4 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.6z"/>
                  <path fill="#FBBC05" d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.6 7C.6 8.5 0 10.2 0 12s.6 3.5 1.6 5l3.5-2.7z"/>
                  <path fill="#34A853" d="M12 23.3c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.1-4.3 1.1-3.3 0-6.1-2.2-7.1-5.3L1.4 16C3.3 20 7.3 23.3 12 23.3z"/>
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          <div className="mt-6 text-sm text-center space-y-1">
            {mode === "signin" && (
              <>
                <button className="text-primary hover:underline" onClick={() => setMode("recover")}>Esqueci a senha</button>
                <div className="text-muted-foreground">
                  Sem conta?{" "}
                  <button className="text-primary font-medium hover:underline" onClick={() => setMode("signup")}>Criar conta</button>
                </div>
              </>
            )}
            {mode !== "signin" && (
              <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Voltar ao login</button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
