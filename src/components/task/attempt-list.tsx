'use client';

import { useEffect, useState } from 'react';
import { AttemptItem } from './attempt-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { Attempt } from '@/types';

interface AttemptListProps {
  taskId: string;
  selectedAttemptId?: string;
  onSelectAttempt?: (attemptId: string) => void;
}

export function AttemptList({ taskId, selectedAttemptId, onSelectAttempt }: AttemptListProps) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/tasks/${taskId}/attempts`);
        if (response.ok) {
          const data = await response.json();
          setAttempts(data.attempts || []);
        }
      } catch (error) {
        console.error('Failed to fetch attempts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttempts();
  }, [taskId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No attempts yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start by sending a prompt below
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {attempts.map((attempt) => (
          <AttemptItem
            key={attempt.id}
            attempt={attempt}
            onClick={() => onSelectAttempt?.(attempt.id)}
            isActive={attempt.id === selectedAttemptId}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
