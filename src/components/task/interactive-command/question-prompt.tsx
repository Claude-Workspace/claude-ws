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
  const [showSubmitView, setShowSubmitView] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = questions[currentQuestionIndex];
  // Add "Type something" as last option (like "Other" in Claude)
  const allOptions = [...currentQuestion.options, { label: 'Type something.', description: '' }];
  const isLastOption = selectedIndex === allOptions.length - 1;

  // Check if a question has been answered
  const isQuestionAnswered = (index: number) => {
    return answers[questions[index].question] !== undefined;
  };

  // All questions answered?
  const allAnswered = questions.every((q) => answers[q.question] !== undefined);
  const answeredCount = questions.filter((q) => answers[q.question] !== undefined).length;

  // Navigate to a specific question tab
  const navigateToTab = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setShowSubmitView(false);
      setCurrentQuestionIndex(index);
      setSelectedIndex(0);
      setSelectedMulti(new Set());
      setCustomInput('');
      setIsTyping(false);
    }
  };

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

      // Submit view keyboard handling
      if (showSubmitView) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, 1)); // 0=Submit, 1=Cancel
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          // Go back to last question
          navigateToTab(questions.length - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex === 0 && allAnswered) {
            onAnswer(answers);
          } else if (selectedIndex === 1) {
            onCancel();
          }
        } else if (e.key === '1') {
          e.preventDefault();
          if (allAnswered) onAnswer(answers);
        } else if (e.key === '2') {
          e.preventDefault();
          onCancel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      // ← → arrow keys navigate between question tabs
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToTab(currentQuestionIndex - 1);
        return;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentQuestionIndex < questions.length - 1) {
          navigateToTab(currentQuestionIndex + 1);
        } else {
          // Last question → go to submit view
          setShowSubmitView(true);
          setSelectedIndex(0);
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
  }, [selectedIndex, isTyping, customInput, currentQuestion, allOptions.length, isLastOption, currentQuestionIndex, questions.length, allAnswered, answers, showSubmitView]);

  const handleSubmitAnswer = (answer: string | string[]) => {
    // Use question text as key (SDK format expects "question" field, not "header")
    const answerValue = Array.isArray(answer) ? answer.join(', ') : answer;
    const newAnswers = { ...answers, [currentQuestion.question]: answerValue };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      // Move to next question
      setCurrentQuestionIndex((i) => i + 1);
      setSelectedIndex(0);
      setSelectedMulti(new Set());
      setCustomInput('');
      setIsTyping(false);
    } else if (questions.length > 1) {
      // Last question answered in multi-question flow → show submit review
      setShowSubmitView(true);
      setSelectedIndex(0);
    } else {
      // Single question → submit directly
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
      {/* Question tab bar */}
      {questions.length > 1 && (
        <div className="flex items-center gap-1 px-4 mb-3 overflow-x-auto">
          {/* Back arrow */}
          <button
            onClick={() => {
              if (showSubmitView) {
                navigateToTab(questions.length - 1);
              } else {
                navigateToTab(currentQuestionIndex - 1);
              }
            }}
            disabled={!showSubmitView && currentQuestionIndex === 0}
            className={cn(
              'shrink-0 text-xs px-1',
              !showSubmitView && currentQuestionIndex === 0
                ? 'text-muted-foreground/30 cursor-default'
                : 'text-muted-foreground hover:text-foreground cursor-pointer'
            )}
          >
            ←
          </button>

          {/* Question tabs */}
          {questions.map((q, i) => {
            const isCurrent = i === currentQuestionIndex && !showSubmitView;
            const answered = isQuestionAnswered(i);
            return (
              <button
                key={i}
                onClick={() => navigateToTab(i)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer',
                  isCurrent
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : answered
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-[10px]">
                  {answered ? '✓' : '□'}
                </span>
                {q.header}
              </button>
            );
          })}

          {/* Submit tab */}
          <button
            onClick={() => {
              setShowSubmitView(true);
              setSelectedIndex(0);
            }}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer',
              showSubmitView
                ? 'bg-primary/15 text-primary border border-primary/30'
                : allAnswered
                  ? 'text-primary hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <span className="text-[10px]">
              {allAnswered ? '✓' : '□'}
            </span>
            Submit
          </button>

          {/* Forward arrow */}
          <button
            onClick={() => {
              if (showSubmitView) {
                // Already on submit, nowhere to go
                return;
              }
              if (currentQuestionIndex < questions.length - 1) {
                navigateToTab(currentQuestionIndex + 1);
              } else {
                // Last question → go to submit view
                setShowSubmitView(true);
                setSelectedIndex(0);
              }
            }}
            disabled={showSubmitView}
            className={cn(
              'shrink-0 text-xs px-1',
              showSubmitView
                ? 'text-muted-foreground/30 cursor-default'
                : 'text-muted-foreground hover:text-foreground cursor-pointer'
            )}
          >
            →
          </button>
        </div>
      )}

      {/* === SUBMIT REVIEW VIEW === */}
      {showSubmitView ? (
        <>
          {/* Review header */}
          <div className="px-4 mb-3">
            <p className="text-sm font-bold">Review your answers</p>
          </div>

          {/* Warning if not all answered */}
          {!allAnswered && (
            <div className="px-4 mb-3">
              <p className="text-sm text-yellow-500">⚠ You have not answered all questions</p>
            </div>
          )}

          {/* Answer summary */}
          {answeredCount > 0 && (
            <div className="px-4 mb-4 space-y-2">
              {questions.map((q, i) => {
                const answer = answers[q.question];
                if (answer === undefined) return null;
                return (
                  <button
                    key={i}
                    onClick={() => navigateToTab(i)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-green-500 text-sm">●</span>
                      <div className="min-w-0">
                        <span className="text-sm text-muted-foreground">{q.question}</span>
                        <div className="text-sm text-foreground">
                          <span className="text-muted-foreground mr-1">→</span>
                          {String(answer)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Submit prompt */}
          <div className="px-4 mb-3">
            <p className="text-sm text-muted-foreground">Ready to submit your answers?</p>
          </div>

          {/* Submit / Cancel options */}
          <div className="space-y-1">
            <button
              onClick={() => { if (allAnswered) onAnswer(answers); }}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-2 text-left transition-colors',
                'hover:bg-muted/50',
                selectedIndex === 0 && 'bg-muted/30',
                !allAnswered && 'opacity-50'
              )}
            >
              <span className="shrink-0 w-4 text-primary font-bold">
                {selectedIndex === 0 ? '›' : ' '}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">1.</span>
              <span className="text-sm font-medium">Submit answers</span>
            </button>
            <button
              onClick={() => onCancel()}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-2 text-left transition-colors',
                'hover:bg-muted/50',
                selectedIndex === 1 && 'bg-muted/30'
              )}
            >
              <span className="shrink-0 w-4 text-primary font-bold">
                {selectedIndex === 1 ? '›' : ' '}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">2.</span>
              <span className="text-sm font-medium">Cancel</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* === QUESTION VIEW === */}

          {/* Header badge (single question fallback) */}
          {questions.length === 1 && (
            <div className="px-4 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded">
                {currentQuestion.header}
              </span>
            </div>
          )}

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
                    } else if (currentQuestion.multiSelect) {
                      // Toggle selection for multi-select
                      setSelectedMulti((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) {
                          next.delete(index);
                        } else {
                          next.add(index);
                        }
                        return next;
                      });
                    } else {
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
        </>
      )}

      {/* Footer hint */}
      <div className="px-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
        <kbd className="px-1 bg-muted rounded">Enter</kbd> to select
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">↑/↓</kbd> to navigate
        {questions.length > 1 && (
          <>
            <span className="mx-2">·</span>
            <kbd className="px-1 bg-muted rounded">←/→</kbd> switch question
          </>
        )}
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">Esc</kbd> to cancel
      </div>
    </div>
  );
}
