'use client';

// Synchronises URL search params with project/task selection state,
// and handles task deep-link resolution on first load.

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { useTaskStore } from '@/stores/task-store';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import type { Task } from '@/types';

/**
 * Keeps ?project= and ?task= URL params in sync with store state,
 * and resolves task deep links on mount.
 */
export function useKanbanUrlSyncAndDeepLinks() {
  const { projects, selectedProjectIds, loading: projectLoading } = useProjectStore();
  const { selectedTask, selectedTaskId, setSelectedTask, setSelectedTaskId, setPendingAutoStartTask } = useTaskStore();
  const [taskDeepLinkProcessed, setTaskDeepLinkProcessed] = useState(false);

  // Read ?project= from URL and select matching project
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('task')) return; // task deep link takes priority

    const projectId = urlParams.get('project');
    if (projectId && projects.length > 0) {
      const exists = projects.some(p => p.id === projectId);
      if (exists) {
        const currentIds = useProjectStore.getState().selectedProjectIds;
        if (currentIds.length !== 1 || currentIds[0] !== projectId) {
          useProjectStore.getState().setSelectedProjectIds([projectId]);
        }
      }
    }
  }, [projects]);

  // Resolve ?task= deep link once projects are loaded
  useEffect(() => {
    if (typeof window === 'undefined' || taskDeepLinkProcessed) return;
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('task');
    if (!taskId || projects.length === 0 || projectLoading) return;

    setTaskDeepLinkProcessed(true);

    const process = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) {
          console.warn(`Task deep link: task ${taskId} not found (${response.status})`);
          removeTaskParam();
          return;
        }

        const task: Task = await response.json();
        const projectExists = projects.some(p => p.id === task.projectId);
        if (!projectExists) {
          console.warn(`Task deep link: project ${task.projectId} not found`);
          removeTaskParam();
          return;
        }

        useProjectStore.getState().setSelectedProjectIds([task.projectId]);

        const unsubscribe = useTaskStore.subscribe((state) => {
          const found = state.tasks.find(t => t.id === task.id);
          if (!found) return;
          unsubscribe();
          if (window.innerWidth < 768) {
            const { openWindow } = useFloatingWindowsStore.getState();
            openWindow(task.id, 'chat', task.projectId);
            useTaskStore.getState().setSelectedTaskId(task.id);
          } else {
            useTaskStore.getState().setSelectedTask(found);
          }
        });

        // Safety: unsubscribe after 10s to prevent memory leak
        setTimeout(() => unsubscribe(), 10000);
      } catch (error) {
        console.warn('Task deep link: failed to fetch task', error);
        removeTaskParam();
      }
    };

    process();
  }, [projects, projectLoading, taskDeepLinkProcessed]);

  // Keep ?project= URL param in sync with selected project
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (selectedProjectIds.length === 1) {
      url.searchParams.set('project', selectedProjectIds[0]);
    } else {
      url.searchParams.delete('project');
    }
    window.history.replaceState({}, '', url.toString());
  }, [selectedProjectIds]);

  // Keep ?task= URL param in sync with selected task
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const currentTaskParam = url.searchParams.get('task');
    const activeId = selectedTask?.id || selectedTaskId;

    if (activeId) {
      if (currentTaskParam !== activeId) {
        url.searchParams.set('task', activeId);
        window.history.replaceState({}, '', url.toString());
      }
    } else if (currentTaskParam) {
      url.searchParams.delete('task');
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedTask, selectedTaskId]);

  return { setSelectedTask, setSelectedTaskId, setPendingAutoStartTask };
}

function removeTaskParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('task');
  window.history.replaceState({}, '', url.toString());
}
