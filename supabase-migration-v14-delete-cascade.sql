-- V14 — Permitir eliminar clientes (e leads) sem violar chaves estrangeiras
-- Recria TODAS as foreign keys que apontam para public.clients com ON DELETE CASCADE.
-- Assim, ao remover um cliente, propostas, ordens de serviço, faturas, movimentos
-- e restantes registos dependentes são removidos automaticamente.

DO $$
DECLARE
  r record;
  cols text;
  refcols text;
BEGIN
  FOR r IN
    SELECT c.conname,
           c.conrelid::regclass AS tbl,
           c.oid
    FROM pg_constraint c
    WHERE c.confrelid = 'public.clients'::regclass
      AND c.contype = 'f'
      AND c.confdeltype <> 'c'
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO cols
    FROM unnest((SELECT conkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.tbl::oid AND a.attnum = x.attnum;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO refcols
    FROM unnest((SELECT confkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = 'public.clients'::regclass AND a.attnum = x.attnum;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.clients (%s) ON DELETE CASCADE',
      r.tbl, r.conname, cols, refcols
    );
  END LOOP;
END $$;

-- Mesmo tratamento para leads (conversão/remoção de leads)
DO $$
DECLARE
  r record;
  cols text;
  refcols text;
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, c.oid
    FROM pg_constraint c
    WHERE c.confrelid = 'public.leads'::regclass
      AND c.contype = 'f'
      AND c.confdeltype = 'a'
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO cols
    FROM unnest((SELECT conkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.tbl::oid AND a.attnum = x.attnum;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
      INTO refcols
    FROM unnest((SELECT confkey FROM pg_constraint WHERE oid = r.oid)) WITH ORDINALITY AS x(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = 'public.leads'::regclass AND a.attnum = x.attnum;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.leads (%s) ON DELETE SET NULL',
      r.tbl, r.conname, cols, refcols
    );
  END LOOP;
END $$;
