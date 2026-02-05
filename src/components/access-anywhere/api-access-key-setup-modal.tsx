'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

interface ApiAccessKeySetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApiAccessKeySetupModal({
  open,
  onOpenChange,
  onSuccess,
}: ApiAccessKeySetupModalProps) {
  const t = useTranslations('accessAnywhere');
  const [apiKey, setApiKey] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a random key when modal opens
  useEffect(() => {
    if (open && !generatedKey) {
      generateNewKey();
    }
  }, [open]);

  const generateNewKey = () => {
    // Generate a 64-character hex key (32 bytes)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const key = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setGeneratedKey(key);
    if (!useCustomKey) {
      setApiKey(key);
    }
  };

  const handleCopy = async () => {
    const keyToCopy = useCustomKey ? apiKey : generatedKey;
    await navigator.clipboard.writeText(keyToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const keyToSave = useCustomKey ? apiKey : generatedKey;

    if (!keyToSave) {
      setError(t('apiKeyRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/settings/api-access-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToSave }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const displayKey = useCustomKey ? apiKey : generatedKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('apiAccessKeyRequired')}
          </DialogTitle>
          <DialogDescription>
            {t('apiAccessKeyDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning alert */}
          <div className="flex gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('apiAccessKeyWarning')}
            </p>
          </div>

          {/* Generated key display */}
          <div className="space-y-2">
            <Label>{t('generatedApiKey')}</Label>
            <div className="flex gap-2">
              <Input
                value={displayKey}
                onChange={(e) => {
                  if (useCustomKey) {
                    setApiKey(e.target.value);
                  }
                }}
                readOnly={!useCustomKey}
                className="font-mono text-sm"
                placeholder={t('enterCustomKey')}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title={copied ? t('copied') : t('copyKey')}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {!useCustomKey && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={generateNewKey}
                  title={t('regenerateKey')}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Custom key toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCustomKey"
              checked={useCustomKey}
              onChange={(e) => {
                setUseCustomKey(e.target.checked);
                if (e.target.checked) {
                  setApiKey('');
                } else {
                  setApiKey(generatedKey);
                }
              }}
              className="rounded border-gray-300"
            />
            <Label htmlFor="useCustomKey" className="text-sm cursor-pointer">
              {t('useCustomKey')}
            </Label>
          </div>

          {/* Important note */}
          <p className="text-xs text-muted-foreground">
            {t('apiKeyStorageNote')}
          </p>

          {error && (
            <div className="flex gap-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('saveAndContinue')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
