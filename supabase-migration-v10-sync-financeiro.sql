-- ============================================================
-- Mtour v10 — Sincronização automática do Financeiro
-- Cole no SQL Editor do Supabase e execute uma vez.
-- Objetivo: lançar em cash_movements todos os valores já
-- registados no sistema (OCs finalizadas, despesas de serviço,
-- turnos TVDE fechados) que ainda não têm o movimento espelho.
-- Também instala triggers para manter a sincronia automática.
-- Idempotente: pode ser executado várias vezes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) BACKFILL: Recebimentos de Ordens de Serviço finalizadas
-- ------------------------------------------------------------
INSERT INTO public.cash_movements (kind, amount, service_order_id, description, movement_date, created_at)
SELECT 'entrada',
       COALESCE(sc.amount_received, so.amount_received, so.sale_value, 0),
       so.id,
       'Recebimento OC ' || COALESCE(so.oc_code, ''),
       COALESCE(sc.closed_at::date, so.service_date, CURRENT_DATE),
       now()
FROM public.service_orders so
LEFT JOIN public.service_closings sc ON sc.service_order_id = so.id
WHERE so.status = 'finalizado'
  AND COALESCE(sc.amount_received, so.amount_received, so.sale_value, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements cm
     WHERE cm.service_order_id = so.id
       AND cm.kind = 'entrada'
       AND cm.service_expense_id IS NULL
  );

-- ------------------------------------------------------------
-- 2) BACKFILL: Despesas de serviço já registadas
-- ------------------------------------------------------------
INSERT INTO public.cash_movements (kind, amount, service_order_id, tvde_shift_id, service_expense_id,
                                   payment_method_id, description, movement_date, created_at)
SELECT 'saida',
       se.amount,
       se.service_order_id,
       se.tvde_shift_id,
       se.id,
       se.payment_method_id,
       'Despesa (' || se.category || ')' ||
         COALESCE(' · ' || NULLIF(se.description, ''), '') ||
         COALESCE(' · OC ' || so.oc_code, ''),
       COALESCE(se.created_at::date, CURRENT_DATE),
       now()
FROM public.service_expenses se
LEFT JOIN public.service_orders so ON so.id = se.service_order_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_movements cm WHERE cm.service_expense_id = se.id
);

-- ------------------------------------------------------------
-- 3) BACKFILL: Turnos TVDE fechados
--    Entrada = líquido plataformas (bruto+gorj+bónus - comissões - retenções)
--    Saída  = comissão devida ao motorista (% extraída das notas)
-- ------------------------------------------------------------
WITH tvde_agg AS (
  SELECT ts.id AS shift_id,
         ts.shift_date,
         ts.notes,
         COALESCE(SUM(te.gross + COALESCE(te.tips,0) + COALESCE(te.bonus,0)
                    - COALESCE(te.commissions,0) - COALESCE(te.other_deductions,0)), 0) AS net_plat,
         (regexp_match(COALESCE(ts.notes,''), 'Motorista %:\s*([0-9]+(?:\.[0-9]+)?)'))[1] AS pct_txt
    FROM public.tvde_shifts ts
    LEFT JOIN public.tvde_earnings te ON te.tvde_shift_id = ts.id
   WHERE ts.closed_at IS NOT NULL
     AND ts.operation_type = 'tvde'
   GROUP BY ts.id
)
INSERT INTO public.cash_movements (kind, amount, tvde_shift_id, description, movement_date, created_at)
SELECT 'entrada', ROUND(net_plat::numeric, 2), shift_id,
       'TVDE · líquido plataformas (' || shift_date || ')',
       shift_date, now()
  FROM tvde_agg
 WHERE net_plat > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.cash_movements cm
      WHERE cm.tvde_shift_id = tvde_agg.shift_id
        AND cm.kind = 'entrada'
        AND cm.service_expense_id IS NULL
   );

WITH tvde_agg AS (
  SELECT ts.id AS shift_id,
         ts.shift_date,
         ts.notes,
         COALESCE(SUM(te.gross + COALESCE(te.tips,0) + COALESCE(te.bonus,0)
                    - COALESCE(te.commissions,0) - COALESCE(te.other_deductions,0)), 0) AS net_plat,
         COALESCE(((regexp_match(COALESCE(ts.notes,''), 'Motorista %:\s*([0-9]+(?:\.[0-9]+)?)'))[1])::numeric, 0) AS pct
    FROM public.tvde_shifts ts
    LEFT JOIN public.tvde_earnings te ON te.tvde_shift_id = ts.id
   WHERE ts.closed_at IS NOT NULL
     AND ts.operation_type = 'tvde'
   GROUP BY ts.id
)
INSERT INTO public.cash_movements (kind, amount, tvde_shift_id, description, movement_date, created_at)
SELECT 'saida',
       ROUND(((net_plat * pct) / 100)::numeric, 2),
       shift_id,
       'TVDE · comissão motorista ' || pct || '% (' || shift_date || ')',
       shift_date, now()
  FROM tvde_agg
 WHERE pct > 0 AND net_plat > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.cash_movements cm
      WHERE cm.tvde_shift_id = tvde_agg.shift_id
        AND cm.kind = 'saida'
        AND cm.service_expense_id IS NULL
        AND cm.description LIKE 'TVDE · comissão motorista%'
   );

-- ------------------------------------------------------------
-- 4) TRIGGER: manter service_expenses ↔ cash_movements sincronizado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_expense_to_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cash_movements WHERE service_expense_id = NEW.id) THEN
      INSERT INTO public.cash_movements (kind, amount, service_order_id, tvde_shift_id,
                                         service_expense_id, payment_method_id, description,
                                         movement_date, created_by)
      VALUES ('saida', NEW.amount, NEW.service_order_id, NEW.tvde_shift_id,
              NEW.id, NEW.payment_method_id,
              'Despesa (' || NEW.category || ')' || COALESCE(' · ' || NULLIF(NEW.description,''), ''),
              COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.paid_by);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements
       SET amount = NEW.amount,
           payment_method_id = NEW.payment_method_id,
           description = 'Despesa (' || NEW.category || ')' || COALESCE(' · ' || NULLIF(NEW.description,''), '')
     WHERE service_expense_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_movements WHERE service_expense_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_expense_to_cash ON public.service_expenses;
CREATE TRIGGER trg_sync_expense_to_cash
  AFTER INSERT OR UPDATE OR DELETE ON public.service_expenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_expense_to_cash();

-- ------------------------------------------------------------
-- 5) TRIGGER: quando service_closings recebe amount_received,
--    garante entrada em cash_movements.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_closing_to_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oc_txt text;
BEGIN
  IF COALESCE(NEW.amount_received, 0) <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.cash_movements
     WHERE service_order_id = NEW.service_order_id
       AND kind = 'entrada'
       AND service_expense_id IS NULL
  ) THEN RETURN NEW; END IF;
  SELECT oc_code INTO oc_txt FROM public.service_orders WHERE id = NEW.service_order_id;
  INSERT INTO public.cash_movements (kind, amount, service_order_id, payment_method_id, description,
                                     movement_date, created_by)
  VALUES ('entrada', NEW.amount_received, NEW.service_order_id, NEW.payment_method_id,
          'Recebimento OC ' || COALESCE(oc_txt, ''),
          COALESCE(NEW.closed_at::date, CURRENT_DATE), NEW.closed_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_closing_to_cash ON public.service_closings;
CREATE TRIGGER trg_sync_closing_to_cash
  AFTER INSERT OR UPDATE ON public.service_closings
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_closing_to_cash();

COMMIT;

-- Verificação rápida:
-- SELECT kind, COUNT(*), SUM(amount) FROM public.cash_movements GROUP BY kind;
