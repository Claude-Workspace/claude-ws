'use client';

import { type LucideIcon, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AgentProviderOptionCardProps {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
  configured: boolean;
  isDefault: boolean;
  onClick: () => void;
}

export function AgentProviderOptionCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  configured,
  isDefault,
  onClick,
}: AgentProviderOptionCardProps) {
  const tCommon = useTranslations('common');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-lg border text-left transition-colors',
        'hover:bg-accent hover:border-primary/50',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        configured && 'border-green-500/50 bg-green-500/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-md', iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{title}</span>
            {configured && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" />
                {tCommon('configured')}
              </span>
            )}
            {isDefault && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {tCommon('default')}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}
