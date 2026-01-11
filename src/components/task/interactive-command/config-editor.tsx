'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { cn } from '@/lib/utils';

interface ConfigSection {
  id: string;
  name: string;
  description: string;
  settings: ConfigSetting[];
}

interface ConfigSetting {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  value: string | number | boolean;
  options?: { value: string; label: string }[];
  description?: string;
}

// Available config sections
const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: 'general',
    name: 'General',
    description: 'General settings',
    settings: [
      { key: 'autoSave', label: 'Auto-save', type: 'boolean', value: true, description: 'Automatically save changes' },
      { key: 'theme', label: 'Theme', type: 'select', value: 'system', options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' },
      ]},
    ],
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Claude AI settings',
    settings: [
      { key: 'maxTokens', label: 'Max Tokens', type: 'number', value: 4096, description: 'Maximum tokens per response' },
      { key: 'temperature', label: 'Temperature', type: 'number', value: 0.7, description: 'Response randomness (0-1)' },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Code editor settings',
    settings: [
      { key: 'fontSize', label: 'Font Size', type: 'number', value: 14 },
      { key: 'tabSize', label: 'Tab Size', type: 'number', value: 2 },
      { key: 'wordWrap', label: 'Word Wrap', type: 'boolean', value: true },
    ],
  },
];

interface ConfigEditorProps {
  section?: string;
}

export function ConfigEditor({ section }: ConfigEditorProps) {
  const [selectedSection, setSelectedSection] = useState<string>(section || CONFIG_SECTIONS[0].id);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { closeCommand, setError } = useInteractiveCommandStore();

  // Initialize values from config
  useEffect(() => {
    const initialValues: Record<string, unknown> = {};
    CONFIG_SECTIONS.forEach((sec) => {
      sec.settings.forEach((setting) => {
        initialValues[`${sec.id}.${setting.key}`] = setting.value;
      });
    });
    setValues(initialValues);
  }, []);

  // Handle value change
  const handleChange = (sectionId: string, key: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [`${sectionId}.${key}`]: value,
    }));
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement config save API
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save config');
      }

      setHasChanges(false);
      closeCommand();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const currentSection = CONFIG_SECTIONS.find((s) => s.id === selectedSection);

  return (
    <div className="flex min-h-[200px]">
      {/* Sidebar */}
      <div className="w-40 border-r bg-muted/20">
        {CONFIG_SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSelectedSection(sec.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
              'hover:bg-muted/50',
              selectedSection === sec.id && 'bg-primary/10 border-r-2 border-primary font-medium'
            )}
          >
            <ChevronRight className={cn(
              'size-3 transition-transform',
              selectedSection === sec.id && 'rotate-90'
            )} />
            {sec.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">
        {currentSection && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="font-medium text-sm">{currentSection.name}</h4>
              <p className="text-xs text-muted-foreground">{currentSection.description}</p>
            </div>

            <div className="space-y-3">
              {currentSection.settings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="text-sm font-medium">{setting.label}</label>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {setting.type === 'boolean' && (
                      <button
                        onClick={() => handleChange(
                          currentSection.id,
                          setting.key,
                          !values[`${currentSection.id}.${setting.key}`]
                        )}
                        className={cn(
                          'w-10 h-5 rounded-full transition-colors relative',
                          values[`${currentSection.id}.${setting.key}`]
                            ? 'bg-primary'
                            : 'bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                            values[`${currentSection.id}.${setting.key}`]
                              ? 'left-5'
                              : 'left-0.5'
                          )}
                        />
                      </button>
                    )}
                    {setting.type === 'number' && (
                      <input
                        type="number"
                        value={values[`${currentSection.id}.${setting.key}`] as number || 0}
                        onChange={(e) => handleChange(
                          currentSection.id,
                          setting.key,
                          parseFloat(e.target.value)
                        )}
                        className="w-20 px-2 py-1 text-sm border rounded bg-background"
                      />
                    )}
                    {setting.type === 'text' && (
                      <input
                        type="text"
                        value={values[`${currentSection.id}.${setting.key}`] as string || ''}
                        onChange={(e) => handleChange(
                          currentSection.id,
                          setting.key,
                          e.target.value
                        )}
                        className="w-40 px-2 py-1 text-sm border rounded bg-background"
                      />
                    )}
                    {setting.type === 'select' && setting.options && (
                      <select
                        value={values[`${currentSection.id}.${setting.key}`] as string || ''}
                        onChange={(e) => handleChange(
                          currentSection.id,
                          setting.key,
                          e.target.value
                        )}
                        className="w-28 px-2 py-1 text-sm border rounded bg-background"
                      >
                        {setting.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {hasChanges ? 'Unsaved changes' : 'No changes'}
          </p>
          <Button
            size="sm"
            disabled={!hasChanges || saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Save className="size-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
