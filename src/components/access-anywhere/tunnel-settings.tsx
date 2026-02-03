'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTunnelStore } from '@/stores/tunnel-store';
import { Copy, RefreshCw, ExternalLink, Trash2, Key, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface TunnelConfig {
  subdomain: string | null;
  email: string | null;
  apiKey: string | null;
  plan: {
    type: string;
    name: string;
    status: string;
    ends_at: string;
    days: number;
    price_cents: number;
  } | null;
}

export function TunnelSettings() {
  const t = useTranslations('accessAnywhere');
  const { getTunnelConfig, resetOnboarding, status, openFirstLoadModal } = useTunnelStore();
  const [config, setConfig] = useState<TunnelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const data = await getTunnelConfig();
    setConfig(data);
    setLoading(false);
  };

  const handleCopyApiKey = () => {
    if (config?.apiKey) {
      navigator.clipboard.writeText(config.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = async () => {
    if (confirm(t('resetConfirmation'))) {
      await resetOnboarding();
      setConfig(null);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 10) return key;
    return `${key.substring(0, 8)}${'•'.repeat(16)}${key.substring(key.length - 4)}`;
  };

  const isExpired = config?.plan ? new Date(config.plan.ends_at) < new Date() : false;
  const daysRemaining = config?.plan
    ? Math.ceil((new Date(config.plan.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('yourTunnelConfig')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('noConfigFound')}</p>
          <div className="flex gap-2">
            <Button onClick={openFirstLoadModal} variant="default">
              {t('setUpTunnel')}
            </Button>
            <Button onClick={() => useTunnelStore.getState().setWizardOpen(true)} variant="outline">
              Advanced Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('yourTunnelConfig')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {status === 'connected' ? `● ${t('connected')}` : `○ ${t('disconnected')}`}
          </Badge>
          {config.subdomain && (
            <Badge variant="outline">
              {config.subdomain}.claude.ws
            </Badge>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t('email')}
          </Label>
          <Input value={config.email || ''} readOnly className="font-mono text-sm" />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            {t('apiKey')}
          </Label>
          <div className="flex gap-2">
            <Input
              value={config.apiKey ? maskApiKey(config.apiKey) : ''}
              readOnly
              className="font-mono text-sm flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyApiKey}
              title={copied ? t('copiedToClipboard') : t('copyApiKey')}
            >
              {copied ? <RefreshCw className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {copied ? t('copiedToClipboard') : t('clickToCopyApiKey')}
          </p>
        </div>

        {/* Plan Info */}
        {config.plan && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('plan')}
            </Label>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{config.plan.name}</span>
                <Badge variant={isExpired ? 'destructive' : 'default'}>
                  {isExpired ? t('expired') : t('active')}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t('planType')}: {config.plan.type}</p>
                {isExpired ? (
                  <p className="text-destructive">{t('expiredOn', { date: format(new Date(config.plan.ends_at), 'PPP') })}</p>
                ) : (
                  <p>
                    {t('expiresIn', { days: daysRemaining, date: format(new Date(config.plan.ends_at), 'PPP') })}
                  </p>
                )}
              </div>
              {isExpired && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('https://claude.ws/access', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('renewPlan')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={loadConfig}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
          <Button variant="destructive" onClick={handleReset}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('resetConfiguration')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
