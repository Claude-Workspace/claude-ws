'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';

interface TunnelStatusIndicatorProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  className?: string;
}

export function TunnelStatusIndicator({ status, className = '' }: TunnelStatusIndicatorProps) {
  const t = useTranslations('accessAnywhere');

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          variant: 'default' as const,
          icon: <CheckCircle2 className="h-3 w-3" />,
          text: t('connected'),
          className: 'bg-green-500 hover:bg-green-600 text-white',
        };
      case 'connecting':
        return {
          variant: 'default' as const,
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: t('connecting'),
          className: 'bg-blue-500 hover:bg-blue-600 text-white',
        };
      case 'error':
        return {
          variant: 'default' as const,
          icon: <XCircle className="h-3 w-3" />,
          text: t('error'),
          className: 'bg-red-500 hover:bg-red-600 text-white',
        };
      default:
        return {
          variant: 'outline' as const,
          icon: <Circle className="h-3 w-3" />,
          text: t('disconnected'),
          className: '',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className={`${config.className} ${className}`}>
      <span className="flex items-center gap-1.5">
        {config.icon}
        {config.text}
      </span>
    </Badge>
  );
}
