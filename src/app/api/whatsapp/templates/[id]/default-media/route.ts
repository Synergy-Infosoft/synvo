import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadTemplateHeaderMediaAsset } from '@/lib/whatsapp/template-default-media';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!profile?.account_id || profile.account_role === 'viewer') {
      return NextResponse.json(
        { error: 'Your role cannot change template media.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      default_header_media_asset_id?: string | null;
    };
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('id, header_type')
      .eq('id', id)
      .eq('account_id', profile.account_id)
      .maybeSingle();
    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    }

    await loadTemplateHeaderMediaAsset({
      supabase,
      accountId: profile.account_id,
      assetId: body.default_header_media_asset_id,
      headerType: template.header_type,
    });

    const { data, error } = await supabase
      .from('message_templates')
      .update({
        default_header_media_asset_id:
          body.default_header_media_asset_id || null,
      })
      .eq('id', id)
      .eq('account_id', profile.account_id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not update default media.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
