'use client';

import { useState, useEffect } from 'react';
import { Key, User, AlertCircle, Check, Lock, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AUTH_STORAGE_KEY = 'claude-ws:user';
const API_KEY_STORAGE_KEY = 'claude-ws:api-key';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface UserData {
  id: string;
  email: string;
  name: string;
}

/**
 * Get stored user data from localStorage
 */
export function getStoredUser(): UserData | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Store user data in localStorage
 */
export function storeUser(user: UserData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Silent fail
  }
}

/**
 * Get stored API key from localStorage
 */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Store API key in localStorage
 */
export function storeApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch {
    // Silent fail
  }
}

/**
 * Clear stored auth data from localStorage
 */
export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'claude' | 'api-key'>('claude');

  // Claude Account tab state
  const [clauEmail, setClaudeEmail] = useState('');
  const [claudeName, setClaudeName] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState('');

  // API Key tab state
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab('claude');
      setClaudeEmail('');
      setClaudeName('');
      setClaudeApiKey('');
      setIsRegistering(false);
      setClaudeError('');
      setApiKey('');
      setApiKeyLoading(false);
      setApiKeyError('');
    }
  }, [open]);

  const handleClaudeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaudeError('');

    if (!clauEmail.trim() || !claudeApiKey.trim()) {
      setClaudeError('Email and API key are required');
      return;
    }

    if (isRegistering && !claudeName.trim()) {
      setClaudeError('Name is required for registration');
      return;
    }

    setClaudeLoading(true);
    try {
      if (isRegistering) {
        // Register new user
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: clauEmail,
            name: claudeName,
            apiKey: claudeApiKey,
          }),
        });

        const data = await res.json();

        if (data.success) {
          storeUser(data.user);
          storeApiKey(claudeApiKey);
          setClaudeEmail('');
          setClaudeName('');
          setClaudeApiKey('');
          onOpenChange(false);
          onSuccess();
        } else {
          setClaudeError(data.error || 'Registration failed');
        }
      } else {
        // Login existing user
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: clauEmail,
            apiKey: claudeApiKey,
          }),
        });

        const data = await res.json();

        if (data.success) {
          storeUser(data.user);
          storeApiKey(claudeApiKey);
          setClaudeEmail('');
          setClaudeApiKey('');
          onOpenChange(false);
          onSuccess();
        } else {
          setClaudeError(data.error || 'Login failed');
        }
      }
    } catch (error) {
      setClaudeError('Failed to connect to server');
    } finally {
      setClaudeLoading(false);
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeyError('');

    if (!apiKey.trim()) {
      setApiKeyError('API key is required');
      return;
    }

    setApiKeyLoading(true);
    try {
      // For API key only mode, just verify and store
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();

      if (data.valid) {
        storeApiKey(apiKey);
        setApiKey('');
        onOpenChange(false);
        onSuccess();
      } else {
        setApiKeyError('Invalid API key');
      }
    } catch (error) {
      setApiKeyError('Failed to verify API key');
    } finally {
      setApiKeyLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[9999]">
        <DialogHeader>
          <DialogTitle>Authentication Required</DialogTitle>
          <DialogDescription>
            Sign in to access Claude Workspace
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'claude' | 'api-key')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="claude" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Claude Account
            </TabsTrigger>
            <TabsTrigger value="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </TabsTrigger>
          </TabsList>

          {/* Claude Account Tab */}
          <TabsContent value="claude" className="space-y-4">
            <form onSubmit={handleClaudeSubmit} className="space-y-4">
              {!isRegistering ? (
                // Login Form
                <>
                  <div className="space-y-2">
                    <label htmlFor="claude-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="claude-email"
                      type="email"
                      value={clauEmail}
                      onChange={(e) => setClaudeEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={claudeLoading}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="claude-apikey" className="text-sm font-medium">
                      API Key
                    </label>
                    <div className="relative">
                      <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="claude-apikey"
                        type="password"
                        value={claudeApiKey}
                        onChange={(e) => setClaudeApiKey(e.target.value)}
                        placeholder="Enter your Claude API key"
                        className="pl-8"
                        disabled={claudeLoading}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        console.anthropic.com
                      </a>
                    </p>
                  </div>
                </>
              ) : (
                // Register Form
                <>
                  <div className="space-y-2">
                    <label htmlFor="claude-name" className="text-sm font-medium">
                      Name
                    </label>
                    <Input
                      id="claude-name"
                      type="text"
                      value={claudeName}
                      onChange={(e) => setClaudeName(e.target.value)}
                      placeholder="Your name"
                      disabled={claudeLoading}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="claude-email-reg" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="claude-email-reg"
                      type="email"
                      value={clauEmail}
                      onChange={(e) => setClaudeEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={claudeLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="claude-apikey-reg" className="text-sm font-medium">
                      API Key
                    </label>
                    <div className="relative">
                      <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="claude-apikey-reg"
                        type="password"
                        value={claudeApiKey}
                        onChange={(e) => setClaudeApiKey(e.target.value)}
                        placeholder="Enter your Claude API key"
                        className="pl-8"
                        disabled={claudeLoading}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        console.anthropic.com
                      </a>
                    </p>
                  </div>
                </>
              )}

              {/* Error */}
              {claudeError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {claudeError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegistering(!isRegistering)}
                  disabled={claudeLoading}
                  className="flex-1"
                >
                  {isRegistering ? (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Back to Login
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Account
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={claudeLoading || !clauEmail || !claudeApiKey || (isRegistering && !claudeName)}
                  className="flex-1"
                >
                  {claudeLoading ? (
                    'Processing...'
                  ) : isRegistering ? (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Register
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* API Key Tab */}
          <TabsContent value="api-key" className="space-y-4">
            <form onSubmit={handleApiKeySubmit} className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <Lock className="h-4 w-4 inline mr-2" />
                  Use API key only mode (no account required)
                </p>
                <p className="text-xs text-muted-foreground">
                  Your API key will be stored locally in your browser
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="api-key-input" className="text-sm font-medium">
                  API Key
                </label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Claude API key"
                    className="pl-8"
                    disabled={apiKeyLoading}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              {/* Error */}
              {apiKeyError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {apiKeyError}
                </div>
              )}

              {/* Success hint */}
              {!apiKeyError && apiKey && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-muted-foreground" />
                  Press Enter or click Submit to verify
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={apiKeyLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={apiKeyLoading || !apiKey}
                  className="flex-1"
                >
                  {apiKeyLoading ? 'Verifying...' : 'Submit'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
