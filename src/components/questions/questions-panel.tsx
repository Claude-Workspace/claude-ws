'use client';

import { useState } from 'react';
import { MessageCircleQuestion, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuestionsStore, type PendingQuestionEntry } from '@/stores/questions-store';
import { useTaskStore } from '@/stores/task-store';
import { cn } from '@/lib/utils';

interface QuestionOption {
  label: string;
  description: string;
}

interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

function QuestionEntryItem({ entry, onAnswered }: { entry: PendingQuestionEntry; onAnswered: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { selectTask } = useTaskStore();
  const { closePanel } = useQuestionsStore();

  const questions = entry.questions as Question[];
  const firstQuestion = questions[0];
  const allAnswered = questions.every((q) => selectedAnswers[q.question] !== undefined);

  const handleSelectOption = (question: string, label: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [question]: label }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/questions/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: entry.attemptId,
          toolUseId: entry.toolUseId,
          questions: entry.questions,
          answers: selectedAnswers,
        }),
      });
      if (res.ok) {
        onAnswered();
      }
    } catch {
      // Failed to answer
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToTask = () => {
    selectTask(entry.taskId);
    closePanel();
  };

  const timeAgo = formatTimeAgo(entry.timestamp);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-2"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate">{entry.taskTitle}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {firstQuestion?.header}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              {firstQuestion?.question}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{q.question}</p>
              <div className="space-y-1">
                {q.options.map((opt) => {
                  const isSelected = selectedAnswers[q.question] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSelectOption(q.question, opt.label)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded text-sm border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        <span className="font-medium">{opt.label}</span>
                      </div>
                      {opt.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-5">{opt.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleGoToTask}
            >
              Go to task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

interface QuestionsPanelProps {
  className?: string;
}

export function QuestionsPanel({ className }: QuestionsPanelProps) {
  const { isOpen, closePanel, pendingQuestions, removeQuestion } = useQuestionsStore();
  const entries = Array.from(pendingQuestions.values()).sort((a, b) => b.timestamp - a.timestamp);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={closePanel}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50',
          'flex flex-col',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="size-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Pending Questions</h2>
            {entries.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {entries.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageCircleQuestion className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No pending questions</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Questions from running tasks will appear here
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <QuestionEntryItem
                key={entry.attemptId}
                entry={entry}
                onAnswered={() => removeQuestion(entry.attemptId)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
