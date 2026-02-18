'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Terminal, ChevronDown, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminal-store';

interface TerminalTabBarProps {
  projectId?: string;
}

export function TerminalTabBar({ projectId }: TerminalTabBarProps) {
  const { tabs, activeTabId, setActiveTab, createTerminal, closeTerminal, closePanel, renameTerminal, sendInput } =
    useTerminalStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNewTerminal = async () => {
    await createTerminal(projectId);
  };

  const handleCloseTab = (e: React.MouseEvent, terminalId: string) => {
    e.stopPropagation();
    closeTerminal(terminalId);
  };

  const startRenaming = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditValue(currentTitle);
  };

  const commitRename = useCallback(() => {
    if (editingTabId) {
      renameTerminal(editingTabId, editValue);
      setEditingTabId(null);
    }
  }, [editingTabId, editValue, renameTerminal]);

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  return (
    <div className="flex items-center h-9 bg-muted/30 border-b px-1 gap-0.5 shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          onDoubleClick={() => startRenaming(tab.id, tab.title)}
          className={cn(
            'flex items-center gap-1.5 px-3 h-7 text-xs rounded-sm transition-colors group',
            'hover:bg-muted',
            activeTabId === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          )}
        >
          <Terminal className="h-3 w-3 shrink-0" />
          {editingTabId === tab.id ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') cancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-b border-foreground/40 outline-none text-xs w-[80px] px-0"
              maxLength={30}
            />
          ) : (
            <span className="truncate max-w-[100px]">{tab.title}</span>
          )}
          {!tab.isConnected && (
            <span className="text-[10px] text-red-400">(exited)</span>
          )}
          <X
            className={cn(
              'h-3 w-3 shrink-0 rounded-sm hover:bg-muted-foreground/20',
              'opacity-0 group-hover:opacity-100',
              activeTabId === tab.id && 'opacity-60'
            )}
            onClick={(e) => handleCloseTab(e, tab.id)}
          />
        </button>
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 ml-1"
        onClick={handleNewTerminal}
        title="New Terminal"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <div className="flex-1" />

      {activeTabId && tabs.find(t => t.id === activeTabId)?.isConnected && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-red-500"
          onClick={() => sendInput(activeTabId, '\x03')}
          title="Send Ctrl+C (SIGINT)"
        >
          <Square className="h-3 w-3 fill-current" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={closePanel}
        title="Close Panel"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
