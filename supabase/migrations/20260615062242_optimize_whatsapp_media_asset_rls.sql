DROP POLICY IF EXISTS whatsapp_media_assets_insert ON public.whatsapp_media_assets;
CREATE POLICY whatsapp_media_assets_insert
  ON public.whatsapp_media_assets FOR INSERT
  WITH CHECK (
    public.is_account_member(account_id, 'agent')
    AND created_by = (SELECT auth.uid())
  );
