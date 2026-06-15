import { describe, expect, it } from 'vitest';
import {
  mediaAcceptFor,
  templateSampleAcceptFor,
  validateTemplateSampleMedia,
  validateWhatsAppMedia,
} from './media-types';

describe('validateWhatsAppMedia', () => {
  it('classifies supported media', () => {
    expect(validateWhatsAppMedia('image/jpeg', 1024).kind).toBe('image');
    expect(validateWhatsAppMedia('audio/mpeg', 1024).kind).toBe('audio');
    expect(validateWhatsAppMedia('application/pdf', 1024).kind).toBe(
      'document'
    );
  });

  it('rejects a mismatched expected kind', () => {
    expect(() => validateWhatsAppMedia('video/mp4', 1024, 'image')).toThrow(
      /detected as video/
    );
  });

  it('rejects unsupported and oversized files', () => {
    expect(() => validateWhatsAppMedia('application/zip', 1024)).toThrow(
      /Unsupported/
    );
    expect(() => validateWhatsAppMedia('image/jpeg', 6 * 1024 * 1024)).toThrow(
      /too large/
    );
  });
});

describe('mediaAcceptFor', () => {
  it('returns only MIME types for the requested kinds', () => {
    const accept = mediaAcceptFor(['image']);
    expect(accept).toContain('image/jpeg');
    expect(accept).not.toContain('video/mp4');
  });
});

describe('validateTemplateSampleMedia', () => {
  it('accepts Meta resumable-upload formats', () => {
    expect(validateTemplateSampleMedia('image/png', 1024).kind).toBe('image');
    expect(validateTemplateSampleMedia('video/mp4', 1024).kind).toBe('video');
    expect(validateTemplateSampleMedia('application/pdf', 1024).kind).toBe(
      'document'
    );
  });

  it('rejects sendable formats that Meta cannot use as approval samples', () => {
    expect(() =>
      validateTemplateSampleMedia('application/msword', 1024)
    ).toThrow(/JPEG, PNG, MP4, or PDF/);
  });

  it('only offers resumable-upload formats to template file pickers', () => {
    const accept = templateSampleAcceptFor(['document']);
    expect(accept).toContain('application/pdf');
    expect(accept).not.toContain('application/msword');
  });
});
