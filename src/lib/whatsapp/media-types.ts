export type WhatsAppMediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker';

interface MediaRule {
  kind: WhatsAppMediaKind;
  maxBytes: number;
}

const MB = 1024 * 1024;

export const WHATSAPP_MEDIA_RULES: Record<string, MediaRule> = {
  'image/jpeg': { kind: 'image', maxBytes: 5 * MB },
  'image/png': { kind: 'image', maxBytes: 5 * MB },
  'image/webp': { kind: 'sticker', maxBytes: 500 * 1024 },
  'video/mp4': { kind: 'video', maxBytes: 16 * MB },
  'video/3gpp': { kind: 'video', maxBytes: 16 * MB },
  'audio/aac': { kind: 'audio', maxBytes: 16 * MB },
  'audio/amr': { kind: 'audio', maxBytes: 16 * MB },
  'audio/mpeg': { kind: 'audio', maxBytes: 16 * MB },
  'audio/mp4': { kind: 'audio', maxBytes: 16 * MB },
  'audio/ogg': { kind: 'audio', maxBytes: 16 * MB },
  'application/pdf': { kind: 'document', maxBytes: 100 * MB },
  'application/msword': { kind: 'document', maxBytes: 100 * MB },
  'application/vnd.ms-excel': { kind: 'document', maxBytes: 100 * MB },
  'application/vnd.ms-powerpoint': { kind: 'document', maxBytes: 100 * MB },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    kind: 'document',
    maxBytes: 100 * MB,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    kind: 'document',
    maxBytes: 100 * MB,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    kind: 'document',
    maxBytes: 100 * MB,
  },
  'text/plain': { kind: 'document', maxBytes: 100 * MB },
};

export interface ValidatedWhatsAppMedia {
  kind: WhatsAppMediaKind;
  mimeType: string;
  maxBytes: number;
}

export function validateWhatsAppMedia(
  mimeType: string,
  sizeBytes: number,
  expectedKind?: WhatsAppMediaKind
): ValidatedWhatsAppMedia {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  const rule = WHATSAPP_MEDIA_RULES[normalized];
  if (!rule) {
    throw new Error(
      `Unsupported WhatsApp media type: ${mimeType || 'unknown'}`
    );
  }
  if (expectedKind && expectedKind !== rule.kind) {
    throw new Error(
      `Selected ${expectedKind}, but the file is detected as ${rule.kind}.`
    );
  }
  if (sizeBytes <= 0) throw new Error('The selected file is empty.');
  if (sizeBytes > rule.maxBytes) {
    throw new Error(
      `File is too large. ${rule.kind} files may be up to ${Math.round(rule.maxBytes / MB)} MB.`
    );
  }
  return { kind: rule.kind, mimeType: normalized, maxBytes: rule.maxBytes };
}

export function mediaAcceptFor(kinds: WhatsAppMediaKind[]): string {
  return Object.entries(WHATSAPP_MEDIA_RULES)
    .filter(([, rule]) => kinds.includes(rule.kind))
    .map(([mime]) => mime)
    .join(',');
}

export function isTemplateHeaderMedia(
  kind: WhatsAppMediaKind
): kind is 'image' | 'video' | 'document' {
  return kind === 'image' || kind === 'video' || kind === 'document';
}

const TEMPLATE_SAMPLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'application/pdf',
]);

export function validateTemplateSampleMedia(
  mimeType: string,
  sizeBytes: number,
  expectedKind?: WhatsAppMediaKind
): ValidatedWhatsAppMedia {
  const validated = validateWhatsAppMedia(mimeType, sizeBytes, expectedKind);
  if (!isTemplateHeaderMedia(validated.kind)) {
    throw new Error('Template headers support image, video, or document media.');
  }
  if (!TEMPLATE_SAMPLE_MIME_TYPES.has(validated.mimeType)) {
    throw new Error(
      'Template approval uploads support JPEG, PNG, MP4, or PDF files.'
    );
  }
  return validated;
}

export function templateSampleAcceptFor(kinds: WhatsAppMediaKind[]): string {
  return Object.entries(WHATSAPP_MEDIA_RULES)
    .filter(
      ([mime, rule]) =>
        kinds.includes(rule.kind) && TEMPLATE_SAMPLE_MIME_TYPES.has(mime)
    )
    .map(([mime]) => mime)
    .join(',');
}
