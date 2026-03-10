'use client';

import { useTerminalLifecycle } from '@/components/terminal/use-terminal-lifecycle';

interface TerminalInstanceProps {
  terminalId: string;
  isVisible: boolean;
  isMobile?: boolean;
}

export function TerminalInstance({ terminalId, isVisible, isMobile }: TerminalInstanceProps) {
  const containerRef = useTerminalLifecycle({ terminalId, isVisible, isMobile });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ display: isVisible ? 'block' : 'none' }}
    />
  );
}
