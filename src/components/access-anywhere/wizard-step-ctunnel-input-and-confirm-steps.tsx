'use client';

// Input and confirmation step views for the ctunnel registration wizard

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, AlertCircle } from 'lucide-react';

export interface InputStepProps {
  email: string;
  subdomain: string;
  checking: boolean;
  registering: boolean;
  availability: { available: boolean; reason: string | null } | null;
  canProceed: boolean;
  errorMessage: string;
  onEmailChange: (v: string) => void;
  onSubdomainChange: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
  labels: Record<string, string>;
}

export interface ConfirmStepProps {
  email: string;
  confirmationCode: string;
  verifying: boolean;
  errorMessage: string;
  onCodeChange: (v: string) => void;
  onVerify: () => void;
  onBack: () => void;
  richDescription: React.ReactNode;
  labels: Record<string, string>;
}

export function InputStep({
  email, subdomain, checking, registering, availability, canProceed,
  errorMessage, onEmailChange, onSubdomainChange, onContinue, onBack, labels,
}: InputStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          type="email"
          placeholder={labels.emailPlaceholder}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={checking || registering}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subdomain">{labels.subdomain}</Label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              id="subdomain"
              placeholder={labels.subdomainPlaceholder}
              value={subdomain}
              onChange={(e) => onSubdomainChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              disabled={registering}
              className={`font-mono pr-10 ${availability ? (canProceed ? 'border-green-500' : 'border-destructive') : ''}`}
            />
            {checking && subdomain.length >= 4 && email ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : availability && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {canProceed
                  ? <Check className="h-4 w-4 text-green-500" />
                  : <AlertCircle className="h-4 w-4 text-destructive" />}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground">.claude.ws</span>
        </div>
        <p className="text-xs text-muted-foreground">{labels.subdomainHint}</p>

        {availability && subdomain && email && (
          <div className={`text-xs flex items-center gap-1 ${canProceed ? 'text-green-600' : 'text-destructive'}`}>
            {canProceed ? (
              availability.reason === 'registered'
                ? <><Check className="h-3 w-3" /><span>{labels.subdomainBelongsToYou}</span></>
                : <><Check className="h-3 w-3" /><span>{labels.subdomainAvailable}</span></>
            ) : (
              <><AlertCircle className="h-3 w-3" /><span>{availability.reason || labels.notAvailable}</span></>
            )}
          </div>
        )}
      </div>

      {errorMessage && !canProceed && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{errorMessage}</div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={registering}>{labels.back}</Button>
        <Button onClick={onContinue} disabled={checking || registering || !subdomain || !email || !canProceed}>
          {checking ? labels.checking : registering ? labels.registering : labels.continue}
        </Button>
      </div>
    </div>
  );
}

export function ConfirmStep({
  email: _email, confirmationCode, verifying, errorMessage,
  onCodeChange, onVerify, onBack, richDescription, labels,
}: ConfirmStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">{labels.confirmationCodeSent}</p>
        <p className="text-muted-foreground">{richDescription}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">{labels.confirmationCode}</Label>
        <Input
          id="code"
          placeholder={labels.confirmationCodePlaceholder}
          value={confirmationCode}
          onChange={(e) => onCodeChange(e.target.value)}
          disabled={verifying}
          maxLength={6}
          className="font-mono text-center text-lg tracking-widest"
        />
      </div>

      {errorMessage && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{errorMessage}</div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={verifying}>{labels.back}</Button>
        <Button onClick={onVerify} disabled={verifying || !confirmationCode}>
          {verifying ? labels.verifying : labels.verifyAndStart}
        </Button>
      </div>
    </div>
  );
}
