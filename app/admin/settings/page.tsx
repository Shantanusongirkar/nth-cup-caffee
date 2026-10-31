'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';

type Channel = 'STAFF_PORTAL' | 'WHATSAPP' | 'BOTH';

const OPTIONS: Array<{ id: Channel; label: string; description: string }> = [
  {
    id: 'STAFF_PORTAL',
    label: 'Staff Portal Only',
    description: 'Orders are saved and shown in the dashboard. WhatsApp does not open for the customer.',
  },
  {
    id: 'WHATSAPP',
    label: 'WhatsApp Only',
    description: 'WhatsApp opens for the customer to send the order. Orders are still saved in the dashboard as a backup.',
  },
  {
    id: 'BOTH',
    label: 'Both (Recommended)',
    description: 'Orders appear in the dashboard AND WhatsApp opens for the customer.',
  },
];

export default function SettingsPage() {
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.orderNotificationChannel) {
          setChannel(data.orderNotificationChannel);
        }
      })
      .catch(() => toast.error('Failed to load settings.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (newChannel: Channel) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNotificationChannel: newChannel }),
      });

      if (res.status === 403) {
        setForbidden(true);
        toast.error('Only the cafe owner can change this setting.');
        return;
      }

      if (!res.ok) throw new Error('Failed to save.');

      setChannel(newChannel);
      toast.success('Order notification setting updated.');
    } catch {
      toast.error('Failed to save setting. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <div className="flex items-center gap-2 border-b border-border/40 pb-4">
        <SettingsIcon className="w-5 h-5 text-primary" />
        <h1 className="font-heading font-extrabold text-2xl text-foreground">Order Settings</h1>
      </div>

      {forbidden && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Only the cafe owner can change this setting.
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-foreground">Where should new orders appear?</h2>
        {OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              channel === option.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'
            } ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input
              type="radio"
              name="channel"
              checked={channel === option.id}
              onChange={() => handleSave(option.id)}
              disabled={isSaving}
              className="accent-primary w-4 h-4 mt-0.5"
            />
            <div>
              <span className="text-sm font-semibold text-foreground block">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </label>
        ))}
      </div>

      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </div>
      )}
    </div>
  );
}