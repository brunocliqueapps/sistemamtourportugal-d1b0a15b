import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, Plus, RefreshCw, AlertTriangle, User2, Search, QrCode, Power, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";
import { sendWhatsappMessage, getWhatsappStatus } from "@/lib/whatsapp.functions";
import { getInstanceStatus, connectInstance, disconnectInstance } from "@/lib/wa-instance.functions";

export const Route = createFileRoute("/mensagens")({
  component: Mensagens,
  head: () => ({
    meta: [
      { title: "Leads · Mtour Portugal" },
      { name: "description", content: "Caixa de entrada WhatsApp Business sincronizada com os leads e clientes do CRM Mtour Portugal." },
      { property: "og:title", content: "Leads · Mtour Portugal" },
      { property: "og:description", content: "Conversas WhatsApp sincronizadas com leads no CRM Mtour Portugal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Conv = {
  id: string;
  wa_phone: string;
  contact_name: string | null;
  client_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  clients?: { id: string; name: string; client_number: string | null } | null;
};

type Msg = {
  id: string;
  direction: string;
  body: string | null;
  msg_type: string;
  status: string;
  error_message: string | null;
  message_at: string;
};

function Mensagens() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newText, setNewText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useServerFn(sendWhatsappMessage);
  const statusFn = useServerFn(getWhatsappStatus);

  const { data: config } = useQuery({
    queryKey: ["wa-status"],
    queryFn: () => statusFn({}),
  });

  // Instância (API não oficial)
  const instStatusFn = useServerFn(getInstanceStatus);
  const connectFn = useServerFn(connectInstance);
  const disconnectFn = useServerFn(disconnectInstance);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);

  const inst = useQuery({
    queryKey: ["wa-instance"],
    queryFn: () => instStatusFn({}),
    refetchInterval: qrOpen ? 5000 : 30000,
  });
  const connected = inst.data?.state === "open";

  useEffect(() => {
    if (qrOpen && connected) {
      setQrOpen(false);
      setQr(null);
      toast.success("WhatsApp ligado com sucesso.");
    }
  }, [qrOpen, connected]);

  const connectMut = useMutation({
    mutationFn: async () => connectFn({}),
    onSuccess: (res: any) => {
      setQr(res?.qr ?? null);
      setPairing(res?.pairingCode ?? null);
      setQrOpen(true);
      if (!res?.qr) toast.info("Instância já ligada ou sem QR disponível.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível gerar o QR Code."),
  });

  const disconnectMut = useMutation({
    mutationFn: async () => disconnectFn({}),
    onSuccess: () => {
      toast.success("Sessão do WhatsApp terminada.");
      inst.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível desligar a instância."),
  });

  const convs = useQuery({
    queryKey: ["wa-convs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_conversations")
        .select("id,wa_phone,contact_name,client_id,last_message,last_message_at,unread_count,clients(id,name,client_number)")
        .eq("archived", false)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Conv[];
    },
  });

  const msgs = useQuery({
    enabled: !!selected,
    queryKey: ["wa-msgs", selected],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_messages")
        .select("id,direction,body,msg_type,status,error_message,message_at")
        .eq("conversation_id", selected)
        .order("message_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Sincronização em tempo real
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-msgs"] });
        qc.invalidateQueries({ queryKey: ["wa-convs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-convs"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.data?.length, selected]);

  // Marca como lida ao abrir
  useEffect(() => {
    if (!selected) return;
    (supabase as any)
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", selected)
      .then(() => qc.invalidateQueries({ queryKey: ["wa-convs"] }));
  }, [selected, qc]);

  const current = useMemo(
    () => (convs.data ?? []).find((c) => c.id === selected) ?? null,
    [convs.data, selected],
  );

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = convs.data ?? [];
    if (!t) return list;
    return list.filter(
      (c) =>
        c.wa_phone.includes(t) ||
        (c.contact_name ?? "").toLowerCase().includes(t) ||
        (c.clients?.name ?? "").toLowerCase().includes(t),
    );
  }, [convs.data, search]);

  const sendMut = useMutation({
    mutationFn: async (p: { phone: string; body: string; conversationId?: string }) =>
      send({ data: p }),
    onSuccess: (res: any) => {
      setDraft("");
      setNewText("");
      setNewPhone("");
      setNewOpen(false);
      if (res?.conversationId) setSelected(res.conversationId);
      qc.invalidateQueries({ queryKey: ["wa-convs"] });
      qc.invalidateQueries({ queryKey: ["wa-msgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível enviar a mensagem."),
  });

  const notConfigured = config && (!config.hasToken || !config.hasPhoneNumberId);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Leads"
        description="Caixa de entrada do WhatsApp Business sincronizada com os leads e clientes."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { convs.refetch(); msgs.refetch(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            {inst.data?.configured && (
              connected ? (
                <Button variant="outline" size="sm" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
                  <Power className="h-4 w-4 mr-2" /> Desligar WhatsApp
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
                  <QrCode className="h-4 w-4 mr-2" /> Ligar WhatsApp
                </Button>
              )
            )}
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova conversa
            </Button>
          </>
        }
      />

      {inst.data?.configured ? (
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">
                  Instância WhatsApp: <span className="font-mono">{inst.data.instance}</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  {connected
                    ? "Ligado — a receber e enviar mensagens."
                    : inst.data.state === "connecting"
                      ? "A ligar… leia o QR Code no telemóvel."
                      : "Desligado — clique em Ligar WhatsApp para ler o QR Code."}
                </div>
              </div>
            </div>
            <Badge variant={connected ? "secondary" : "outline"}>
              {connected ? "Ligado" : (inst.data.state ?? "desligado")}
            </Badge>
          </div>
        </Card>
      ) : (
        <Card className="p-4 mb-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-medium">Instância WhatsApp ainda não configurada</div>
              <p className="text-muted-foreground">
                Para usar a API não oficial (por instância) é preciso guardar os segredos{" "}
                <span className="font-mono">EVOLUTION_API_URL</span>,{" "}
                <span className="font-mono">EVOLUTION_API_KEY</span>,{" "}
                <span className="font-mono">EVOLUTION_INSTANCE</span> e{" "}
                <span className="font-mono">EVOLUTION_WEBHOOK_TOKEN</span>. Depois basta ligar o
                telemóvel por QR Code. O webhook da instância deve apontar para:
              </p>
              <code className="block text-xs bg-muted rounded px-2 py-1 mt-1 break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/public/whatsapp/evolution?token=SEU_TOKEN
              </code>
              {notConfigured ? null : (
                <p className="text-muted-foreground text-xs">A Cloud API oficial continua ativa como alternativa.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-0 overflow-hidden flex flex-col max-h-[70vh] lg:max-h-[75vh]">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Procurar conversa…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {convs.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">A carregar…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Sem conversas.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-3 py-3 transition-colors ${
                    selected === c.id ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {c.clients?.name ?? c.contact_name ?? c.wa_phone}
                    </span>
                    {c.unread_count > 0 && <Badge className="shrink-0">{c.unread_count}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    +{c.wa_phone}
                    {c.clients?.client_number ? ` · ${c.clients.client_number}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.last_message ?? ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col min-h-[420px] max-h-[70vh] lg:max-h-[75vh]">
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 p-6 text-center">
              <MessageSquare className="h-8 w-8" />
              Selecione uma conversa para ver o histórico.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {current.clients?.name ?? current.contact_name ?? `+${current.wa_phone}`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">+{current.wa_phone}</div>
                </div>
                {current.clients ? (
                  <Badge variant="secondary" className="shrink-0">
                    <User2 className="h-3 w-3 mr-1" /> {current.clients.client_number ?? "Cliente"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">Sem cliente ligado</Badge>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
                {(msgs.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === "out"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div
                        className={`text-[10px] mt-1 ${
                          m.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {fmtDateTime(m.message_at)}
                        {m.direction === "out" ? ` · ${m.status}` : ""}
                      </div>
                      {m.error_message && (
                        <div className="text-[10px] mt-1 text-destructive">{m.error_message}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-border flex items-end gap-2">
                <Textarea
                  rows={2}
                  placeholder="Escrever mensagem…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim())
                        sendMut.mutate({ phone: current.wa_phone, body: draft.trim(), conversationId: current.id });
                    }
                  }}
                />
                <Button
                  onClick={() =>
                    draft.trim() &&
                    sendMut.mutate({ phone: current.wa_phone, body: draft.trim(), conversationId: current.id })
                  }
                  disabled={sendMut.isPending || !draft.trim()}
                  className="h-11 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Número (com indicativo do país)</Label>
              <Input
                placeholder="351912345678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea rows={4} value={newText} onChange={(e) => setNewText(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              A Meta só permite mensagens livres nas 24h após a última mensagem do cliente. Fora dessa
              janela é necessário usar um template aprovado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              disabled={sendMut.isPending || !newPhone.trim() || !newText.trim()}
              onClick={() => sendMut.mutate({ phone: newPhone.trim(), body: newText.trim() })}
            >
              <Send className="h-4 w-4 mr-2" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>

      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar WhatsApp por QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              No telemóvel: WhatsApp → Definições → Dispositivos ligados → Ligar dispositivo e leia o
              código abaixo.
            </p>
            {qr ? (
              <img
                src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code para ligar o WhatsApp à instância"
                className="mx-auto h-64 w-64 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="text-muted-foreground">Sem QR Code disponível.</div>
            )}
            {pairing && (
              <div className="text-center">
                Código de emparelhamento: <span className="font-mono font-semibold">{pairing}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
              <RefreshCw className="h-4 w-4 mr-2" /> Novo QR
            </Button>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
