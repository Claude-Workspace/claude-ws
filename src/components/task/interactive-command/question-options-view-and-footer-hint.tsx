'use client';

import { RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { Question } from '@/components/task/interactive-command/question-answer-utils';

// -- Prop types --

interface QuestionOptionsViewProps {
  currentQuestion: Question;
  allOptions: { label: string; description: string }[];
  selectedIndex: number;
  selectedMulti: Set<number>;
  existingCustom: string | null;
  answers: Record<string, string | string[]>;
  isTyping: boolean;
  customInput: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelectOption: (index: number) => void;
  onCustomInputChange: (value: string) => void;
  onMultiSubmit: () => void;
  labels: { typeYourAnswer: string };
}

// -- Components --

export function QuestionOptionsView({
  currentQuestion,
  allOptions,
  selectedIndex,
  selectedMulti,
  existingCustom,
  answers,
  isTyping,
  customInput,
  inputRef,
  onSelectOption,
  onCustomInputChange,
  onMultiSubmit,
  labels,
}: QuestionOptionsViewProps) {
  const currentAnswer = answers[currentQuestion.question];

  return (
    <>
      <div className="px-4 mb-4">
        <p className="text-sm font-medium">{currentQuestion.question}</p>
      </div>

      <div className="space-y-1">
        {allOptions.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isChecked = selectedMulti.has(index);
          const isTypeOption = index === allOptions.length - 1;
          const isPreviousAnswer =
            currentAnswer !== undefined &&
            (isTypeOption
              ? existingCustom !== null
              : currentQuestion.options[index]?.label === String(currentAnswer));

          return (
            <button
              key={index}
              onClick={() => onSelectOption(index)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-2 text-left transition-colors',
                'hover:bg-muted/50',
                isSelected && 'bg-muted/30'
              )}
            >
              <span
                className={cn(
                  'shrink-0 w-4 font-bold',
                  isPreviousAnswer ? 'text-green-500' : 'text-primary'
                )}
              >
                {isSelected ? '\u203A' : ' '}
              </span>
              <span
                className={cn(
                  'shrink-0 text-sm',
                  isPreviousAnswer ? 'text-green-500' : 'text-muted-foreground'
                )}
              >
                {index + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {currentQuestion.multiSelect && !isTypeOption && (
                    <span
                      className={cn(
                        'size-4 border rounded flex items-center justify-center text-xs',
                        isChecked && 'bg-primary text-primary-foreground'
                      )}
                    >
                      {isChecked && '\u2713'}
                    </span>
                  )}
                  <span className={cn('text-sm font-medium', isPreviousAnswer && 'text-green-500')}>
                    {option.label}
                  </span>
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{option.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isTyping && (
        <div className="px-4 mt-3">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            placeholder={labels.typeYourAnswer}
            className="w-full px-3 py-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
      )}

      {currentQuestion.multiSelect && selectedMulti.size > 0 && (
        <div className="px-4 mt-3">
          <button
            onClick={onMultiSubmit}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Submit ({selectedMulti.size} selected)
          </button>
        </div>
      )}
    </>
  );
}

export function FooterHint({ questionCount }: { questionCount: number }) {
  return (
    <div className="px-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
      <kbd className="px-1 bg-muted rounded">Enter</kbd> to select
      <span className="mx-2">&middot;</span>
      <kbd className="px-1 bg-muted rounded">&uarr;/&darr;</kbd> to navigate
      {questionCount > 1 && (
        <>
          <span className="mx-2">&middot;</span>
          <kbd className="px-1 bg-muted rounded">&larr;/&rarr;</kbd> switch question
        </>
      )}
      <span className="mx-2">&middot;</span>
      <kbd className="px-1 bg-muted rounded">Esc</kbd> to cancel
    </div>
  );
}
