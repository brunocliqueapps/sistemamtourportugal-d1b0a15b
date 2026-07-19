import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/pesquisa/$token")({ component: PesquisaPublica });

function PesquisaPublica() {
  const { token } = Route.useParams();
  const [survey, setSurvey] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("surveys").select("*").eq("token", token).maybeSingle();
      setSurvey(s);
      if (s?.template_id) {
        const { data: t } = await supabase.from("survey_templates").select("*").eq("id", s.template_id).maybeSingle();
        setTemplate(t);
      }
      setDone(s?.status === "respondido");
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    const questions = template?.questions ?? [];
    const ratings = questions.filter((q: any) => q.type === "rating").map((q: any) => Number(answers[q.id])).filter((n: number) => !isNaN(n));
    const avg = ratings.length ? +(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2) : null;
    const nps = questions.find((q: any) => q.type === "nps");
    const npsScore = nps ? Number(answers[nps.id]) : null;

    const answersArr = questions.map((q: any) => ({ id: q.id, label: q.label, type: q.type, value: answers[q.id] ?? null }));

    const { error } = await supabase.from("surveys").update({
      answers: answersArr, average_score: avg, nps_score: isNaN(npsScore as any) ? null : npsScore,
      status: "respondido", answered_at: new Date().toISOString(),
    }).eq("token", token);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">A carregar…</div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center">Pesquisa não encontrada.</div>;
  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold">Obrigado!</h1>
        <p className="mt-2 text-muted-foreground">A sua resposta foi registada. Agradecemos o seu tempo.</p>
      </Card>
    </div>
  );

  const questions = template?.questions ?? [];
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 max-w-2xl w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">{survey.client_name ? `Olá ${survey.client_name}, ` : ""}gostaríamos de conhecer a sua opinião.</p>
        </div>
        <div className="space-y-6">
          {questions.map((q: any) => (
            <div key={q.id} className="space-y-2">
              <div className="font-medium text-sm">{q.label} {q.required && <span className="text-destructive">*</span>}</div>
              {q.type === "rating" && (
                <div className="flex gap-2">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: n })}
                      className={`h-10 w-10 rounded-full border ${answers[q.id] === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>{n}</button>
                  ))}
                </div>
              )}
              {q.type === "nps" && (
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: n })}
                      className={`h-9 w-9 rounded border text-sm ${answers[q.id] === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>{n}</button>
                  ))}
                </div>
              )}
              {q.type === "yes_no" && (
                <div className="flex gap-2">
                  {["sim","nao"].map((v) => (
                    <Button key={v} type="button" variant={answers[q.id] === v ? "default" : "outline"} onClick={() => setAnswers({ ...answers, [q.id]: v })}>
                      {v === "sim" ? "Sim" : "Não"}
                    </Button>
                  ))}
                </div>
              )}
              {q.type === "text" && (
                <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <Button className="gradient-gold text-gold-foreground w-full" onClick={submit}>Enviar resposta</Button>
      </Card>
    </div>
  );
}
