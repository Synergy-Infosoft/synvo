import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessageTemplate } from '@/types';
import type { StoredWhatsAppMediaAsset } from './media-assets';

const ASSET_COLUMNS =
  'id, account_id, media_type, mime_type, original_filename, storage_path, meta_media_id, meta_uploaded_at';

export function isMediaHeaderType(
  headerType: MessageTemplate['header_type']
): headerType is 'image' | 'video' | 'document' {
  return (
    headerType === 'image' ||
    headerType === 'video' ||
    headerType === 'document'
  );
}

export async function loadTemplateHeaderMediaAsset(args: {
  supabase: SupabaseClient;
  accountId: string;
  assetId?: string | null;
  headerType?: MessageTemplate['header_type'];
}): Promise<StoredWhatsAppMediaAsset | null> {
  if (!args.assetId) return null;
  if (!isMediaHeaderType(args.headerType)) {
    throw new Error('Only media-header templates can have default media.');
  }
  const { data, error } = await args.supabase
    .from('whatsapp_media_assets')
    .select(ASSET_COLUMNS)
    .eq('account_id', args.accountId)
    .eq('id', args.assetId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Template header media was not found for this account.');
  }
  if (data.media_type !== args.headerType) {
    throw new Error(
      `This template requires a ${args.headerType} header, but ${data.media_type} was selected.`
    );
  }
  return data as StoredWhatsAppMediaAsset;
}
