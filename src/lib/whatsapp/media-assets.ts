import { supabaseAdmin } from '@/lib/flows/admin-client';
import { uploadWhatsAppMedia } from './meta-api';

const MEDIA_BUCKET = 'whatsapp-media';
const META_MEDIA_REFRESH_MS = 29 * 24 * 60 * 60 * 1000;

export interface StoredWhatsAppMediaAsset {
  id: string;
  account_id: string;
  media_type: string;
  mime_type: string;
  original_filename: string;
  storage_path: string;
  meta_media_id: string;
  meta_uploaded_at: string;
}

export function metaMediaNeedsRefresh(
  uploadedAt: string,
  now = Date.now()
): boolean {
  const timestamp = new Date(uploadedAt).getTime();
  return (
    !Number.isFinite(timestamp) || now - timestamp >= META_MEDIA_REFRESH_MS
  );
}

/**
 * Return a usable Meta media id, refreshing it from the private canonical
 * Supabase copy before Meta's temporary upload expires.
 */
export async function ensureMetaMediaId(args: {
  asset: StoredWhatsAppMediaAsset;
  phoneNumberId: string;
  accessToken: string;
}): Promise<string> {
  if (!metaMediaNeedsRefresh(args.asset.meta_uploaded_at)) {
    return args.asset.meta_media_id;
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .download(args.asset.storage_path);
  if (error || !data) {
    throw new Error(
      `Could not refresh WhatsApp media: ${error?.message ?? 'file missing'}`
    );
  }
  const { mediaId } = await uploadWhatsAppMedia({
    phoneNumberId: args.phoneNumberId,
    accessToken: args.accessToken,
    file: data,
    filename: args.asset.original_filename,
  });
  const { error: updateError } = await admin
    .from('whatsapp_media_assets')
    .update({
      meta_media_id: mediaId,
      meta_uploaded_at: new Date().toISOString(),
    })
    .eq('id', args.asset.id)
    .eq('account_id', args.asset.account_id);
  if (updateError) {
    throw new Error(
      `Could not save refreshed WhatsApp media id: ${updateError.message}`
    );
  }
  return mediaId;
}
