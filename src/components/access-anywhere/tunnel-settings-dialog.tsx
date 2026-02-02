'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTunnelStore } from '@/stores/tunnel-store';
import { Copy, RefreshCw, ExternalLink, Trash2, Key, Mail, Calendar, Globe, Check } from 'lucide-react';
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

export function TunnelSettingsDialog() {
  const t = useTranslations('accessAnywhere');
  const status = useTunnelStore(state => state.status);
  const url = useTunnelStore(state => state.url);
  const wizardOpen = useTunnelStore(state => state.wizardOpen);
  const [config, setConfig] = useState<TunnelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await useTunnelStore.getState().getTunnelConfig();
      setConfig(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wizardOpen) {
      loadConfig();
    }
  }, [wizardOpen]);

  // Derive subdomain from config or URL
  const subdomain = config?.subdomain || (url ? new URL(url).hostname.split('.')[0] : null);

  const handleCopyApiKey = () => {
    if (config?.apiKey) {
      navigator.clipboard.writeText(config.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    if (subdomain) {
      const tunnelUrl = `${subdomain}.claude.ws`;
      navigator.clipboard.writeText(tunnelUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset the tunnel configuration? This will clear all saved settings and open the setup wizard again.')) {
      setResetting(true);
      try {
        await useTunnelStore.getState().resetOnboarding();
        // resetOnboarding already sets wizardStep=0 and wizardOpen=true
        // The AccessAnywhereWizard will now show the welcome step since config is cleared
      } finally {
        setResetting(false);
      }
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

  return (
    <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) useTunnelStore.getState().setWizardOpen(false); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="py-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </div>
        ) : !config && !subdomain ? (
          <div className="py-8 text-center text-muted-foreground">
            No tunnel configuration found. Please set up Access Anywhere first.
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Access Anywhere
              </DialogTitle>
              <DialogDescription>
                Your workspace tunnel configuration
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant={status === 'connected' ? 'default' : 'secondary'}
                  className={status === 'connected' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                >
                  {status === 'connected' ? '● Connected' : '○ Disconnected'}
                </Badge>
                {subdomain && (
                  <>
                    <a
                      href={`https://${subdomain}.claude.ws`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      <Badge variant="outline" className="cursor-pointer">
                        {subdomain}.claude.ws
                      </Badge>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUrl}
                      title={copiedUrl ? 'Copied!' : 'Copy URL'}
                    >
                      {copiedUrl ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </>
                )}
              </div>

              {/* Email */}
              {config?.email && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input value={config.email} readOnly className="font-mono text-sm" />
              </div>
              )}

              {/* API Key */}
              {config?.apiKey && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={maskApiKey(config.apiKey)}
                    readOnly
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyApiKey}
                    title={copied ? 'Copied!' : 'Copy API key'}
                  >
                    {copied ? <RefreshCw className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {copied ? 'Copied to clipboard!' : 'Click to copy full API key'}
                </p>
              </div>
              )}

              {/* Plan Info */}
              {config?.plan && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Plan
                  </Label>
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{config.plan.name}</span>
                      <Badge variant={isExpired ? 'destructive' : 'default'}>
                        {isExpired ? 'Expired' : 'Active'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Type: {config.plan.type}</p>
                      {isExpired ? (
                        <p className="text-destructive">Expired on {format(new Date(config.plan.ends_at), 'PPP')}</p>
                      ) : (
                        <p>
                          Expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} ({format(new Date(config.plan.ends_at), 'PPP')})
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
                        Renew Plan
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={loadConfig} disabled={resetting}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="destructive" onClick={handleReset} disabled={resetting}>
                  {resetting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {resetting ? 'Resetting...' : 'Reset Configuration'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
