-- Private reusable media library for WhatsApp sends.
CREATE TABLE IF NOT EXISTS public.whatsapp_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (
    media_type IN ('image', 'video', 'audio', 'document', 'sticker')
  ),
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  storage_path TEXT NOT NULL UNIQUE,
  meta_media_id TEXT NOT NULL,
  meta_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_media_assets_account_created
  ON public.whatsapp_media_assets(account_id, created_at DESC);

ALTER TABLE public.whatsapp_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_media_assets_select ON public.whatsapp_media_assets;
CREATE POLICY whatsapp_media_assets_select
  ON public.whatsapp_media_assets FOR SELECT
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS whatsapp_media_assets_insert ON public.whatsapp_media_assets;
CREATE POLICY whatsapp_media_assets_insert
  ON public.whatsapp_media_assets FOR INSERT
  WITH CHECK (
    public.is_account_member(account_id, 'agent')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS whatsapp_media_assets_delete ON public.whatsapp_media_assets;
CREATE POLICY whatsapp_media_assets_delete
  ON public.whatsapp_media_assets FOR DELETE
  USING (public.is_account_member(account_id, 'agent'));

GRANT SELECT, INSERT, DELETE ON public.whatsapp_media_assets TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  FALSE,
  104857600,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg',
    'video/mp4', 'video/3gpp',
    'application/pdf', 'application/msword',
    'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The browser never accesses this private bucket directly. Authenticated
-- proxy routes verify account membership and use the service-role client.
DROP POLICY IF EXISTS "Members can read whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Members can update whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete whatsapp media" ON storage.objects;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_asset_id UUID
    REFERENCES public.whatsapp_media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS location_address TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_media_asset
  ON public.messages(media_asset_id)
  WHERE media_asset_id IS NOT NULL;
