import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  uploadTemplateSampleMedia,
  uploadWhatsAppMedia,
} from '@/lib/whatsapp/meta-api';
import {
  validateTemplateSampleMedia,
  validateWhatsAppMedia,
  type WhatsAppMediaKind,
} from '@/lib/whatsapp/media-types';

export const runtime = 'nodejs';

const MEDIA_BUCKET = 'whatsapp-media';

function safeFilename(filename: string): string {
  const ext = filename
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const base =
    filename
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60) || 'media';
  return ext ? `${base}.${ext}` : base;
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profile?.account_id) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      );
    }
    if (profile.account_role === 'viewer') {
      return NextResponse.json(
        { error: 'Your role cannot upload WhatsApp media.' },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    const expectedKindRaw = form.get('expected_kind');
    const purpose = form.get('purpose');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const expectedKind =
      typeof expectedKindRaw === 'string' && expectedKindRaw
        ? (expectedKindRaw as WhatsAppMediaKind)
        : undefined;
    const isTemplateSample = purpose === 'template_sample';
    const validated = isTemplateSample
      ? validateTemplateSampleMedia(file.type, file.size, expectedKind)
      : validateWhatsAppMedia(file.type, file.size, expectedKind);

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', profile.account_id)
      .single();
    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 }
      );
    }

    const filename = safeFilename(file.name);
    uploadedPath = `account-${profile.account_id}/${crypto.randomUUID()}-${filename}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const admin = supabaseAdmin();
    const { error: storageError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(uploadedPath, bytes, {
        contentType: validated.mimeType,
        upsert: false,
        cacheControl: '3600',
      });
    if (storageError)
      throw new Error(`Storage upload failed: ${storageError.message}`);

    const { mediaId } = await uploadWhatsAppMedia({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      file,
      filename,
    });
    const headerHandle = isTemplateSample
      ? (
          await uploadTemplateSampleMedia({
            accessToken: decrypt(config.access_token),
            file,
            filename,
          })
        ).headerHandle
      : undefined;

    const { data: asset, error: assetError } = await supabase
      .from('whatsapp_media_assets')
      .insert({
        account_id: profile.account_id,
        created_by: user.id,
        media_type: validated.kind,
        mime_type: validated.mimeType,
        original_filename: file.name,
        size_bytes: file.size,
        storage_path: uploadedPath,
        meta_media_id: mediaId,
        meta_uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (assetError || !asset) {
      throw new Error(
        `Could not save media asset: ${assetError?.message ?? 'unknown error'}`
      );
    }

    return NextResponse.json({
      id: asset.id,
      media_type: asset.media_type,
      mime_type: asset.mime_type,
      original_filename: asset.original_filename,
      size_bytes: asset.size_bytes,
      media_url: `/api/whatsapp/media-assets/${asset.id}`,
      header_handle: headerHandle,
    });
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin().storage.from(MEDIA_BUCKET).remove([uploadedPath]);
    }
    const message =
      error instanceof Error ? error.message : 'Media upload failed';
    console.error('[whatsapp/media-assets] upload failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
