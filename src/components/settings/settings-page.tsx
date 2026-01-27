'use client';

import { useState } from 'react';
import { ArrowLeft, FolderOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/project-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';

export function SettingsPage() {
  const { currentProject, updateProject } = useProjectStore();
  const { setOpen: setSettingsOpen } = useSettingsUIStore();
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveName = async () => {
    if (!currentProject || !editingName.trim()) return;
    await updateProject(currentProject.id, { name: editingName.trim() });
    setIsEditing(false);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(false)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setSettingsOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Current Project Section */}
      {currentProject && (
        <div className="max-w-2xl space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Current Project</h2>
            <div className="space-y-3 p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-9"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveName}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium text-lg">{currentProject.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingName(currentProject.name);
                        setIsEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
              <div className="pl-8">
                <p className="text-sm text-muted-foreground">{currentProject.path}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
