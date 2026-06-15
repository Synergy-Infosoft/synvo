-- Asset deletion must remove both the private Storage object and the
-- database row. Until a server-side delete endpoint owns that operation,
-- prevent direct Data API deletes that would orphan stored files.
DROP POLICY IF EXISTS whatsapp_media_assets_delete
  ON public.whatsapp_media_assets;

REVOKE DELETE ON public.whatsapp_media_assets FROM authenticated;
