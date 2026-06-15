'use client';

import { useEffect, useState } from 'react';
import { LocateFixed, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MediaUploadField,
  type UploadedMediaAsset,
} from './media-upload-field';
import type { WhatsAppMediaKind } from '@/lib/whatsapp/media-types';
import { toast } from 'sonner';

export type AttachmentMode =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location';

export interface LocationDraft {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface AttachmentDialogProps {
  open: boolean;
  mode: AttachmentMode;
  onOpenChange: (open: boolean) => void;
  onSendMedia: (asset: UploadedMediaAsset, caption: string) => Promise<void>;
  onSendLocation: (location: LocationDraft) => Promise<void>;
}

const MODE_LABELS: Record<AttachmentMode, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  location: 'Location',
};

export function AttachmentDialog({
  open,
  mode,
  onOpenChange,
  onSendMedia,
  onSendLocation,
}: AttachmentDialogProps) {
  const [asset, setAsset] = useState<UploadedMediaAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) {
      setAsset(null);
      setCaption('');
      setLatitude('');
      setLongitude('');
      setName('');
      setAddress('');
      setSending(false);
      setLocating(false);
    }
  }, [open]);

  async function submit() {
    setSending(true);
    try {
      if (mode === 'location') {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        ) {
          throw new Error('Enter a valid latitude and longitude.');
        }
        await onSendLocation({
          latitude: lat,
          longitude: lng,
          name: name.trim() || undefined,
          address: address.trim() || undefined,
        });
      } else {
        if (!asset) throw new Error(`Choose a ${mode} first.`);
        await onSendMedia(asset, caption.trim());
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not send attachment.'
      );
    } finally {
      setSending(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support location access.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocating(false);
      },
      (error) => {
        toast.error(error.message || 'Could not read your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  const canSend =
    mode === 'location'
      ? latitude.trim().length > 0 && longitude.trim().length > 0
      : asset !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {`Send ${MODE_LABELS[mode].toLowerCase()}`}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {mode === 'location'
              ? 'Share a precise map location in this conversation.'
              : 'The file is securely stored and uploaded to WhatsApp before sending.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'location' ? (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700"
              disabled={locating}
              onClick={useCurrentLocation}
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              Use current location
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="location-latitude">Latitude</Label>
                <Input
                  id="location-latitude"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location-longitude">Longitude</Label>
                <Input
                  id="location-longitude"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="location-name">Place name</Label>
              <Input
                id="location-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Synergy Infosoft"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="location-address">Address</Label>
              <Input
                id="location-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Street, city, country"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <MediaUploadField
              kinds={[mode as WhatsAppMediaKind]}
              value={asset}
              onChange={setAsset}
              disabled={sending}
            />
            {mode !== 'audio' && (
              <div className="space-y-1">
                <Label htmlFor="attachment-caption">Caption</Label>
                <Textarea
                  id="attachment-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={1024}
                  placeholder="Optional caption"
                  className="border-slate-700 bg-slate-800"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button disabled={!canSend || sending} onClick={() => void submit()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
