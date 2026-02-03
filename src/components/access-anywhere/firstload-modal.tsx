'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTunnelStore } from '@/stores/tunnel-store';

/**
 * FirstLoadModal - Modal shown on first load to introduce tunnel feature
 *
 * Behavior:
 * - Only shows when user hasn't completed onboarding (no tunnel config)
 * - Once closed/dismissed, it sets a flag to never show again automatically
 * - Can be reopened from Settings > Access Anywhere section
 * - Shows the "Access Your Workspace Anywhere" modal with device illustration
 */
export function FirstLoadModal() {
  const { wizardOpen, setWizardOpen, setWizardStep, onboardingCompleted } = useTunnelStore();

  useEffect(() => {
    // Check if firstload modal was previously dismissed
    const firstloadDismissed = localStorage.getItem('firstload_dismissed') === 'true';

    // If onboarding is not completed and firstload wasn't dismissed, show the modal
    if (!onboardingCompleted && !firstloadDismissed) {
      setWizardOpen(true);
      setWizardStep(0); // Welcome step
    }
  }, [onboardingCompleted, setWizardOpen, setWizardStep]);

  const handleGetStarted = () => {
    // Mark as dismissed so it won't auto-show again
    localStorage.setItem('firstload_dismissed', 'true');
    // Move to next step (method selection)
    setWizardStep(1);
  };

  const handleClose = () => {
    // Mark as dismissed and close modal
    localStorage.setItem('firstload_dismissed', 'true');
    setWizardOpen(false);
  };

  return (
    <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <VisuallyHidden>
          <DialogTitle>Access Your Workspace Anywhere</DialogTitle>
        </VisuallyHidden>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="flex flex-col items-center p-6 sm:p-8 space-y-6 text-center">
          {/* Icon/Illustration - Devices with connection */}
          <div className="h-20 w-20 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full text-muted-foreground"
            >
              {/* Tablet */}
              <rect x="4" y="2" width="10" height="14" rx="2" />
              <line x1="9" x2="9" y1="18" y2="18" />

              {/* Phone */}
              <rect x="14" y="8" width="6" height="10" rx="1" />
              <line x1="17" x2="17" y1="18" y2="18" />

              {/* Connection/WiFi signal */}
              <path d="M2 12c2-2 4-2 6 0" />
              <path d="M1 9c3-3 6-3 9 0" />
              <path d="M0 6c4-4 8-4 12 0" />
            </svg>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Access Your Workspace Anywhere
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Access Claude Workspace from your phone, tablet, or any device on the internet. Perfect for remote work or sharing with team members.
            </p>
          </div>

          {/* Get Started Button */}
          <div className="w-full pt-2">
            <Button
              onClick={handleGetStarted}
              className="w-full sm:w-auto min-w-[140px]"
              size="lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
