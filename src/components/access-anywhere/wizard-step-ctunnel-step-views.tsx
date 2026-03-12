'use client';

// Connected, error, and connecting step views for the ctunnel registration wizard
// Input and confirm steps live in wizard-step-ctunnel-input-and-confirm-steps.tsx

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Loader2, Check } from 'lucide-react';

export type { InputStepProps, ConfirmStepProps } from './wizard-step-ctunnel-input-and-confirm-steps';
export { InputStep, ConfirmStep } from './wizard-step-ctunnel-input-and-confirm-steps';

export interface ConnectedStepProps {
  url: string;
  copied: boolean;
  onCopyUrl: () => void;
  onBack: () => void;
  onFinish: () => void;
  labels: Record<string, string>;
}

export interface ErrorStepProps {
  errorMessage: string;
  onBack: () => void;
  onRetry: () => void;
  labels: Record<string, string>;
}

export function ConnectedStep({ url, copied, onCopyUrl, onBack, onFinish, labels }: ConnectedStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-green-500/10 text-green-600 rounded-lg p-4 flex items-start gap-2">
        <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">{labels.subdomainRegistered}</p>
          <p className="text-sm text-muted-foreground mt-1">{labels.workspaceAccessibleAt}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">{labels.yourPublicUrl}</Label>
        <div className="flex gap-2">
          <Input id="url" value={url} readOnly className="font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={onCopyUrl} title={labels.copyUrl}>
            {copied
              ? <Check className="h-4 w-4 text-green-600" />
              : <ExternalLink className="h-4 w-4" />}
          </Button>
        </div>
        {copied && <p className="text-xs text-green-600">{labels.urlCopied}</p>}
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">{labels.testYourUrl}</p>
        <p className="text-muted-foreground">{labels.testYourUrlDescription}</p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>{labels.back}</Button>
        <Button onClick={onFinish}>{labels.finish}</Button>
      </div>
    </div>
  );
}

export function ErrorStep({ errorMessage, onBack, onRetry, labels }: ErrorStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-destructive/10 text-destructive rounded-lg p-4">
        <p className="font-medium mb-1">{labels.error}</p>
        <p className="text-sm">{errorMessage}</p>
      </div>
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>{labels.back}</Button>
        <Button onClick={onRetry}>{labels.tryAgain}</Button>
      </div>
    </div>
  );
}

export function ConnectingStep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center space-y-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
