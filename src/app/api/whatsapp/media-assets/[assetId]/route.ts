import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export const runtime = 'nodejs';

function contentDispositionFilename(filename: string): string {
  return (
    filename
      .replace(/[\u0000-\u001f\u007f"\\]/g, '')
      .trim()
      .slice(0, 180) || 'whatsapp-media'
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS verifies that the caller belongs to the asset's account.
    const { data: asset, error } = await supabase
      .from('whatsapp_media_assets')
      .select('storage_path, mime_type, original_filename')
      .eq('id', assetId)
      .maybeSingle();
    if (error || !asset) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const { data, error: downloadError } = await supabaseAdmin()
      .storage.from('whatsapp-media')
      .download(asset.storage_path);
    if (downloadError || !data) {
      throw new Error(downloadError?.message ?? 'Storage download failed');
    }

    const disposition = new URL(request.url).searchParams.has('download')
      ? 'attachment'
      : 'inline';
    return new Response(data, {
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Disposition': `${disposition}; filename="${contentDispositionFilename(asset.original_filename)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[whatsapp/media-assets] download failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
