'use client';

import { useRef, useState } from 'react';
import {
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  mediaAcceptFor,
  templateSampleAcceptFor,
  validateWhatsAppMedia,
  type WhatsAppMediaKind,
} from '@/lib/whatsapp/media-types';
import { toast } from 'sonner';

export interface UploadedMediaAsset {
  id: string;
  media_type: WhatsAppMediaKind;
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  media_url: string;
  header_handle?: string;
}

interface MediaUploadFieldProps {
  kinds: WhatsAppMediaKind[];
  value: UploadedMediaAsset | null;
  onChange: (asset: UploadedMediaAsset | null) => void;
  disabled?: boolean;
  purpose?: 'send' | 'template_sample';
}

function KindIcon({ kind }: { kind: WhatsAppMediaKind }) {
  if (kind === 'image' || kind === 'sticker')
    return <ImageIcon className="h-4 w-4" />;
  if (kind === 'video') return <Video className="h-4 w-4" />;
  if (kind === 'audio') return <FileAudio className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaUploadField({
  kinds,
  value,
  onChange,
  disabled = false,
  purpose = 'send',
}: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    try {
      const expectedKind = kinds.length === 1 ? kinds[0] : undefined;
      validateWhatsAppMedia(file.type, file.size, expectedKind);
      setUploading(true);
      const form = new FormData();
      form.append('file', file);
      if (expectedKind) form.append('expected_kind', expectedKind);
      if (purpose === 'template_sample') {
        form.append('purpose', 'template_sample');
      }
      const response = await fetch('/api/whatsapp/media-assets', {
        method: 'POST',
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error || `Upload failed with HTTP ${response.status}`
        );
      }
      onChange(payload as UploadedMediaAsset);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Media upload failed.'
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={
          purpose === 'template_sample'
            ? templateSampleAcceptFor(kinds)
            : mediaAcceptFor(kinds)
        }
        disabled={disabled || uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-800 p-3">
          <span className="bg-primary/15 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
            <KindIcon kind={value.media_type} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">
              {value.original_filename}
            </p>
            <p className="text-[11px] text-slate-500">
              {formatBytes(value.size_bytes)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Remove media"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          className="w-full border-dashed border-slate-700 bg-slate-800/50 text-slate-300"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading
            ? purpose === 'template_sample'
              ? 'Uploading approval sample...'
              : 'Uploading to WhatsApp...'
            : 'Choose media'}
        </Button>
      )}
    </div>
  );
}
