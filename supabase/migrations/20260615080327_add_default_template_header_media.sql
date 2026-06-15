-- A media-header template still needs a real image/video/document on every
-- send. Keep one durable account-scoped asset as the default so agents do not
-- have to upload the same file for every message, broadcast, or automation.
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS default_header_media_asset_id UUID
    REFERENCES public.whatsapp_media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_templates_default_header_media
  ON public.message_templates(default_header_media_asset_id)
  WHERE default_header_media_asset_id IS NOT NULL;
