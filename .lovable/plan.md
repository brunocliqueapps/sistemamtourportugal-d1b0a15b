# Logo da empresa por upload

## Situação atual
- Em Configurações > Empresa já existe uma área de upload para o Logo e para o QR Code do Instagram, mas o armazenamento de ficheiros (bucket `logos`) não existe no backend — nenhum bucket está criado. Por isso qualquer tentativa de upload falha com erro.
- Em Configurações > Proposta Comercial (cabeçalho dos documentos) o Logo continua a ser apenas um campo de texto "Logo (URL)".
- O logo mostrado no menu lateral e na página inicial é uma imagem fixa do projeto, não o logo carregado pela empresa.

## O que vai ser feito
1. Criar o armazenamento público de imagens (`logos`) com permissões: leitura pública (para os PDFs funcionarem) e upload/substituição/remoção apenas para utilizadores autenticados.
2. Manter e finalizar o upload já existente em Configurações > Empresa: escolher ficheiro, pré-visualização, substituir e remover, com validação de tipo de imagem e tamanho máximo (5 MB) e mensagem de erro clara.
3. Substituir o campo de texto "Logo (URL)" no cabeçalho dos documentos pelo mesmo componente de upload, para não haver dois modos diferentes.
4. Fazer o logo do menu lateral e da página inicial usar o logo carregado da empresa, mantendo a imagem atual como alternativa caso ainda não exista upload.

## Notas técnicas
- Bucket via ferramenta de storage (`logos`, público) + políticas em `storage.objects` por migração.
- Extrair o componente `FileUpload` de `src/routes/configuracoes.tsx` para `src/components/ImageUploadField.tsx` e reutilizar em `DocumentHeaderSettings.tsx`.
- Nome do ficheiro: `logo/<timestamp>.<ext>` com `upsert: false`; guardar o `publicUrl` em `company_settings.logo_url` / `instagram_qr_url`.
- `src/components/layout/Logo.tsx` passa a ler `company_settings.logo_url` (react-query, chave `company`) com fallback para `mtour-logo.asset.json`.
