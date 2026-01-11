'use client';

import { useState, useEffect, useRef } from 'react';
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

interface QuestionPromptProps {
  questions: Question[];
  onAnswer: (answers: Record<string, string | string[]>) => void;
  onCancel: () => void;
}

export function QuestionPrompt({ questions, onAnswer, onCancel }: QuestionPromptProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = questions[currentQuestionIndex];
  // Add "Type something" as last option (like "Other" in Claude)
  const allOptions = [...currentQuestion.options, { label: 'Type something.', description: '' }];
  const isLastOption = selectedIndex === allOptions.length - 1;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsTyping(false);
          setCustomInput('');
        } else if (e.key === 'Enter' && customInput.trim()) {
          e.preventDefault();
          handleSubmitAnswer(customInput.trim());
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isLastOption) {
          // Enter typing mode
          setIsTyping(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        } else if (currentQuestion.multiSelect) {
          // Toggle selection for multi-select
          setSelectedMulti((prev) => {
            const next = new Set(prev);
            if (next.has(selectedIndex)) {
              next.delete(selectedIndex);
            } else {
              next.add(selectedIndex);
            }
            return next;
          });
        } else {
          // Single select - submit answer
          handleSubmitAnswer(currentQuestion.options[selectedIndex].label);
        }
      } else if (e.key === ' ' && currentQuestion.multiSelect && !isLastOption) {
        e.preventDefault();
        // Space toggles for multi-select
        setSelectedMulti((prev) => {
          const next = new Set(prev);
          if (next.has(selectedIndex)) {
            next.delete(selectedIndex);
          } else {
            next.add(selectedIndex);
          }
          return next;
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (/^[1-9]$/.test(e.key)) {
        // Number key shortcuts
        const num = parseInt(e.key, 10) - 1;
        if (num < allOptions.length) {
          setSelectedIndex(num);
          if (num === allOptions.length - 1) {
            setIsTyping(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          } else if (!currentQuestion.multiSelect) {
            handleSubmitAnswer(currentQuestion.options[num].label);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, isTyping, customInput, currentQuestion, allOptions.length, isLastOption]);

  const handleSubmitAnswer = (answer: string | string[]) => {
    const newAnswers = { ...answers, [currentQuestion.header]: answer };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      // Move to next question
      setCurrentQuestionIndex((i) => i + 1);
      setSelectedIndex(0);
      setSelectedMulti(new Set());
      setCustomInput('');
      setIsTyping(false);
    } else {
      // All questions answered
      onAnswer(newAnswers);
    }
  };

  const handleMultiSubmit = () => {
    if (selectedMulti.size === 0) return;
    const selectedLabels = Array.from(selectedMulti).map((i) => currentQuestion.options[i].label);
    handleSubmitAnswer(selectedLabels);
  };

  return (
    <div className="py-4">
      {/* Header badge */}
      <div className="px-4 mb-2">
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded">
          {currentQuestion.header}
        </span>
      </div>

      {/* Question text */}
      <div className="px-4 mb-4">
        <p className="text-sm font-medium">{currentQuestion.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-1">
        {allOptions.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isChecked = selectedMulti.has(index);
          const isTypeOption = index === allOptions.length - 1;

          return (
            <button
              key={index}
              onClick={() => {
                setSelectedIndex(index);
                if (isTypeOption) {
                  setIsTyping(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                } else if (!currentQuestion.multiSelect) {
                  handleSubmitAnswer(currentQuestion.options[index].label);
                }
              }}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-2 text-left transition-colors',
                'hover:bg-muted/50',
                isSelected && 'bg-muted/30'
              )}
            >
              {/* Selection indicator */}
              <span className="shrink-0 w-4 text-primary font-bold">
                {isSelected ? '›' : ' '}
              </span>

              {/* Number */}
              <span className="shrink-0 text-sm text-muted-foreground">
                {index + 1}.
              </span>

              {/* Option content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {currentQuestion.multiSelect && !isTypeOption && (
                    <span className={cn(
                      'size-4 border rounded flex items-center justify-center text-xs',
                      isChecked && 'bg-primary text-primary-foreground'
                    )}>
                      {isChecked && '✓'}
                    </span>
                  )}
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                    {option.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom input field (shown when typing) */}
      {isTyping && (
        <div className="px-4 mt-3">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-3 py-2 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
      )}

      {/* Multi-select submit button */}
      {currentQuestion.multiSelect && selectedMulti.size > 0 && (
        <div className="px-4 mt-3">
          <button
            onClick={handleMultiSubmit}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Submit ({selectedMulti.size} selected)
          </button>
        </div>
      )}

      {/* Footer hint */}
      <div className="px-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
        <kbd className="px-1 bg-muted rounded">Enter</kbd> to select
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">↑/↓</kbd> to navigate
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">Esc</kbd> to cancel
      </div>
    </div>
  );
}
