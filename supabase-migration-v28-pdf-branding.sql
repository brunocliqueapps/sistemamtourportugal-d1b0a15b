-- Migração v28: Campos para Proposta Comercial e Social Media no PDF
alter table public.company_settings
add column if not exists instagram_url text,
add column if not exists facebook_url text,
add column if not exists instagram_qr_url text;

comment on column public.company_settings.instagram_qr_url is 'URL de uma imagem do QR Code do Instagram para exibir nos PDFs';
