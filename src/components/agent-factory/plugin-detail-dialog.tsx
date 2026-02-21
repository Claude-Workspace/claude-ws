'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, Folder, FileText, File, ChevronRight, ChevronDown, Loader2, X, PackageSearch, Terminal, Copy, AlertTriangle, AlertCircle, RefreshCw, Edit3, Save, X as XIcon } from 'lucide-react';
import hljs from 'highlight.js';
// Custom syntax highlighting theme in globals.css - no need for github-dark.css
import { Plugin, DiscoveredPlugin } from '@/types/agent-factory';
import { DependencyTree, type DependencyTreeNode, countPlugins } from './dependency-tree';
import { Textarea } from '@/components/ui/textarea';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileContent {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
}

interface LibraryDep {
  name: string;
  version?: string;
  manager: string;
}

interface InstallScripts {
  npm?: string;
  pnpm?: string;
  yarn?: string;
  pip?: string;
  poetry?: string;
  cargo?: string;
  go?: string;
  dockerfile?: string;
}

interface DependencyInfo {
  libraries: LibraryDep[];
  plugins: Array<{
    type: 'skill' | 'command' | 'agent';
    name: string;
  }>;
  installScripts?: InstallScripts;
  dependencyTree?: DependencyTreeNode[];
  depth?: number;
  hasCycles?: boolean;
  resolvedAt?: number;
}

type PluginDetailProps = Plugin | DiscoveredPlugin;

interface PluginDetailDialogProps {
  plugin: PluginDetailProps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isImportedPlugin(plug: PluginDetailProps): plug is Plugin {
  return 'id' in plug && 'storageType' in plug;
}

export function PluginDetailDialog({
  plugin,
  open,
  onOpenChange,
}: PluginDetailDialogProps) {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const isImported = isImportedPlugin(plugin);
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'dependencies'>('details');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mobileFileModalOpen, setMobileFileModalOpen] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyInfo | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [reResolvingDeps, setReResolvingDeps] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset state when plugin changes
  useEffect(() => {
    setFiles([]);
    setSelectedFile(null);
    setFileContent(null);
    setDependencies(null);
    setExpandedDirs(new Set());
    setError(null);
    setActiveTab('details');
    setActiveScriptTab('');
    setCopiedScript(null);
    setIsEditing(false);
    setEditedContent('');
    setSaving(false);
  }, [plugin.name, plugin.sourcePath]);

  useEffect(() => {
    if (open && activeTab === 'files' && files.length === 0) {
      fetchFiles();
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (open && activeTab === 'dependencies' && !dependencies) {
      fetchDependencies();
    }
  }, [open, activeTab]);

  // Set active script tab to first available when dependencies change
  useEffect(() => {
    if (dependencies?.installScripts) {
      const scripts = dependencies.installScripts;
      const availableTabs = ['npm', 'pnpm', 'yarn', 'pip', 'poetry', 'cargo', 'go', 'docker'] as const;
      for (const tab of availableTabs) {
        if (tab === 'docker' ? scripts.dockerfile : scripts[tab]) {
          setActiveScriptTab(tab);
          break;
        }
      }
    }
  }, [dependencies]);

  useEffect(() => {
    if (fileContent && codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [fileContent]);

  // Re-highlight when modal opens (for when codeRef becomes available)
  useEffect(() => {
    if (mobileFileModalOpen && fileContent) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (codeRef.current) {
          hljs.highlightElement(codeRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mobileFileModalOpen, fileContent]);

  const fetchFiles = async () => {
    setLoadingFiles(true);
    setError(null);
    try {
      let fileData;
      if (isImported) {
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/files`);
        if (!res.ok) throw new Error(t('failedToLoadFiles'));
        fileData = await res.json();
      } else {
        // For discovered plugins, use a different endpoint that reads from sourcePath
        const res = await fetch('/api/agent-factory/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: plugin.sourcePath, type: plugin.type }),
        });
        if (!res.ok) throw new Error(t('failedToLoadFiles'));
        fileData = await res.json();
      }
      setFiles(fileData.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadFiles'));
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchFileContent = async (filePath: string) => {
    setLoadingContent(true);
    setError(null);
    try {
      let data;
      if (isImported) {
        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/files/${encodedPath}`);
        if (!res.ok) throw new Error(t('failedToLoadFile'));
        data = await res.json();
      } else {
        // For discovered plugins
        const res = await fetch('/api/agent-factory/file-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            basePath: plugin.sourcePath,
            filePath,
          }),
        });
        if (!res.ok) throw new Error(t('failedToLoadFile'));
        data = await res.json();
      }
      setFileContent(data);
      setMobileFileModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadFile'));
    } finally {
      setLoadingContent(false);
    }
  };

  const fetchDependencies = async () => {
    setLoadingDeps(true);
    setError(null);
    try {
      let data;
      if (isImported) {
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/dependencies`);
        if (!res.ok) throw new Error(t('failedToLoadDependencies'));
        data = await res.json();
      } else {
        // For discovered plugins
        const res = await fetch('/api/agent-factory/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: plugin.sourcePath, type: plugin.type }),
        });
        if (!res.ok) throw new Error(t('failedToLoadDependencies'));
        data = await res.json();
      }
      setDependencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadDependencies'));
    } finally {
      setLoadingDeps(false);
    }
  };

  const reResolveDependencies = async () => {
    setReResolvingDeps(true);
    setError(null);
    try {
      if (isImported) {
        // For imported plugins, use POST endpoint with Claude SDK analysis
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useClaude: true }),
        });
        if (!res.ok) throw new Error(t('failedToReResolveDependencies'));
        const data = await res.json();
        setDependencies(data);
      } else {
        // For discovered plugins, re-fetch with POST to trigger Claude analysis
        const res = await fetch('/api/agent-factory/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePath: plugin.sourcePath,
            type: plugin.type,
            useClaude: true,
          }),
        });
        if (!res.ok) throw new Error(t('failedToAnalyzeDependencies'));
        const data = await res.json();
        setDependencies(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToReResolveDependencies'));
    } finally {
      setReResolvingDeps(false);
    }
  };

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      setSelectedFile(node.path);
      fetchFileContent(node.path);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'skill':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'command':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'agent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderFileTree = (nodes: FileNode[], level = 0): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-1 px-2 hover:bg-muted rounded cursor-pointer text-sm ${
            selectedFile === node.path ? 'bg-muted' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'directory' ? (
            <>
              {expandedDirs.has(node.path) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <Folder className="w-4 h-4 text-blue-500" />
            </>
          ) : (
            <>
              <span className="w-4 h-3" />
              <File className="w-4 h-4 text-gray-500" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'directory' &&
          expandedDirs.has(node.path) &&
          node.children &&
          renderFileTree(node.children, level + 1)}
      </div>
    ));
  };

  const getFileIconColor = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
      'js': 'text-yellow-500',
      'jsx': 'text-yellow-500',
      'ts': 'text-blue-500',
      'tsx': 'text-blue-500',
      'py': 'text-green-500',
      'rb': 'text-red-500',
      'go': 'text-cyan-500',
      'rs': 'text-orange-500',
      'java': 'text-orange-600',
      'c': 'text-blue-600',
      'cpp': 'text-blue-600',
      'cs': 'text-purple-500',
      'php': 'text-purple-600',
      'swift': 'text-orange-500',
      'kt': 'text-purple-600',
      'sh': 'text-green-600',
      'bash': 'text-green-600',
      'sql': 'text-blue-400',
      'json': 'text-yellow-400',
      'yaml': 'text-pink-500',
      'yml': 'text-pink-500',
      'xml': 'text-orange-400',
      'html': 'text-orange-500',
      'htm': 'text-orange-500',
      'css': 'text-blue-400',
      'scss': 'text-pink-400',
      'sass': 'text-pink-400',
      'less': 'text-blue-300',
      'md': 'text-blue-300',
      'markdown': 'text-blue-300',
      'txt': 'text-gray-400',
      'dockerfile': 'text-blue-500',
      'docker': 'text-blue-500',
    };
    return colorMap[ext || ''] || 'text-gray-500';
  };

  const formatMetadata = () => {
    if (isImported && plugin.metadata) {
      try {
        return JSON.stringify(JSON.parse(plugin.metadata), null, 2);
      } catch {
        return plugin.metadata;
      }
    } else if (!isImported && plugin.metadata) {
      return JSON.stringify(plugin.metadata, null, 2);
    }
    return null;
  };

  const metadataStr = formatMetadata();

  // Check if current plugin can be edited (local storage only)
  const canEdit = isImported && plugin.storageType === 'local';

  const handleStartEdit = () => {
    if (fileContent) {
      setEditedContent(fileContent.content);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const handleSave = async () => {
    if (!isImported || !fileContent) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/files/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: fileContent.path,
          content: editedContent,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save file');
      }

      // Update file content with saved version
      setFileContent({
        ...fileContent,
        content: editedContent,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              {plugin.name}
              {!isImported && (
                <Badge variant="outline" className="text-xs">{t('discovered')}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isImported ? t('pluginDetails') : t('discoveredPluginDetails')}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'files' | 'dependencies')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="details">{t('details')}</TabsTrigger>
              <TabsTrigger value="files">{t('files')}</TabsTrigger>
              <TabsTrigger value="dependencies">{t('dependencies')}</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-6">
                {/* Type Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <Badge className={getTypeColor(plugin.type)}>
                    {plugin.type}
                  </Badge>
                </div>

                {/* Description */}
                {plugin.description && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('pluginDescription')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      {plugin.description}
                    </p>
                  </div>
                )}

                {/* Source Path */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('sourcePath')}</span>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded block pl-6 break-all">
                    {plugin.sourcePath}
                  </code>
                </div>

                {/* Storage Type - only for imported */}
                {isImported && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('storage')}</span>
                    <Badge variant="secondary">{plugin.storageType}</Badge>
                  </div>
                )}

                {/* Metadata */}
                {metadataStr && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('metadata')}</span>
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto pl-6">
                      {metadataStr}
                    </pre>
                  </div>
                )}

                {/* Timestamps - only for imported */}
                {isImported && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: {new Date(plugin.createdAt).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      Updated: {new Date(plugin.updatedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="files" className="flex-1 overflow-y-auto mt-4">
              {/* File Tree */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 border-b bg-muted/50 text-sm font-medium">
                  {t('files')}
                </div>
                <div className="p-2 max-h-[400px] overflow-y-auto">
                  {loadingFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : error ? (
                    <div className="text-sm text-destructive py-4">{error}</div>
                  ) : files.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">{t('noFilesFound')}</div>
                  ) : (
                    renderFileTree(files)
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-6">
                {/* Header with re-resolve button */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {dependencies && dependencies.resolvedAt
                      ? `Last resolved: ${new Date(dependencies.resolvedAt).toLocaleString()}`
                      : t('dependencies')}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={reResolveDependencies}
                    disabled={reResolvingDeps}
                    className="gap-2"
                  >
                    {reResolvingDeps ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('reResolving')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        {t('reResolve')}
                      </>
                    )}
                  </Button>
                </div>

                {loadingDeps ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-sm text-destructive py-4">{error}</div>
                ) : !dependencies ? (
                  <div className="text-sm text-muted-foreground py-4">{t('noDependenciesFound')}</div>
                ) : (
                  <>
                    {/* Library Dependencies */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <PackageSearch className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">{t('libraryDependencies')}</h3>
                        <Badge variant="secondary">{dependencies.libraries.length}</Badge>
                      </div>
                      {dependencies.libraries.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-6">{t('noExternalLibraries')}</p>
                      ) : (
                        <div className="pl-6 space-y-4">
                          {/* Library badges */}
                          <div className="flex flex-wrap gap-2">
                            {dependencies.libraries.map((lib, idx) => (
                              <Badge key={idx} variant="outline" className="font-mono text-xs">
                                {lib.name}
                                {lib.version && <span className="text-muted-foreground">@{lib.version}</span>}
                                <span className="text-muted-foreground">({lib.manager})</span>
                              </Badge>
                            ))}
                          </div>

                          {/* Install Scripts */}
                          {(() => {
                            const scripts = dependencies.installScripts;
                            return scripts && Object.values(scripts).some(v => v) && (
                              <div className="mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Terminal className="w-4 h-4 text-muted-foreground" />
                                  <h4 className="text-sm font-medium">{t('installScripts')}</h4>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                  <div className="flex border-b bg-muted/50">
                                    {scripts.npm && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'npm'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('npm')}
                                    >
                                      npm
                                    </button>
                                  )}
                                  {scripts.pnpm && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'pnpm'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('pnpm')}
                                    >
                                      pnpm
                                    </button>
                                  )}
                                  {scripts.yarn && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'yarn'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('yarn')}
                                    >
                                      yarn
                                    </button>
                                  )}
                                  {scripts.pip && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'pip'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('pip')}
                                    >
                                      pip
                                    </button>
                                  )}
                                  {scripts.poetry && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'poetry'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('poetry')}
                                    >
                                      poetry
                                    </button>
                                  )}
                                  {scripts.cargo && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'cargo'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('cargo')}
                                    >
                                      cargo
                                    </button>
                                  )}
                                  {scripts.go && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'go'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('go')}
                                    >
                                      go
                                    </button>
                                  )}
                                  {scripts.dockerfile && (
                                    <button
                                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeScriptTab === 'docker'
                                          ? 'bg-background text-foreground border-b-2 border-primary'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                      }`}
                                      onClick={() => setActiveScriptTab('docker')}
                                    >
                                      Docker
                                    </button>
                                  )}
                                </div>

                                <div className="relative group">
                                  <pre className="text-xs bg-muted p-3 overflow-x-auto">
                                    <code>
                                      {activeScriptTab === 'docker' && scripts.dockerfile
                                        ? scripts.dockerfile.split('\n').map((line, i) => (
                                            <div key={i}>
                                              {line}
                                            </div>
                                          ))
                                        : scripts[activeScriptTab as keyof InstallScripts] || ''
                                      }
                                    </code>
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      const script = scripts[activeScriptTab as keyof InstallScripts];
                                      if (script) {
                                        navigator.clipboard.writeText(script);
                                        setCopiedScript(activeScriptTab);
                                        setTimeout(() => setCopiedScript(null), 2000);
                                      }
                                    }}
                                  >
                                    {copiedScript === activeScriptTab ? (
                                      <span className="text-green-500 text-xs">Copied!</span>
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Plugin Dependencies */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">{t('pluginDependencies')}</h3>
                        <Badge variant="secondary">
                          {dependencies.dependencyTree ? countPlugins(dependencies.dependencyTree) : dependencies.plugins.length}
                        </Badge>
                      </div>
                      {(!dependencies.dependencyTree || dependencies.dependencyTree.length === 0) && dependencies.plugins.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-6">{t('noPluginDependencies')}</p>
                      ) : (
                        <div className="pl-6">
                          {dependencies.dependencyTree ? (
                            <DependencyTree nodes={dependencies.dependencyTree} />
                          ) : (
                            <div className="space-y-2">
                              {dependencies.plugins.map((plug, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Badge className={getTypeColor(plug.type)}>{plug.type}</Badge>
                                  <span className="text-sm">{plug.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resolution Info */}
                    {dependencies && (dependencies.depth !== undefined || dependencies.hasCycles) && (
                      <div className="text-xs text-muted-foreground pl-6 space-y-1 pt-2 border-t">
                        {dependencies.depth !== undefined && (
                          <div>Resolution depth: <span className="font-medium text-foreground">{dependencies.depth}</span></div>
                        )}
                        {dependencies.hasCycles && (
                          <div className="text-orange-500">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            {t('circularDependencies')}
                          </div>
                        )}
                        {dependencies.resolvedAt && (
                          <div>Last resolved: {new Date(dependencies.resolvedAt).toLocaleString()}</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)}>{tCommon('close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Modal */}
      <Dialog open={mobileFileModalOpen} onOpenChange={(open) => {
        if (!open) {
          // Reset edit mode when closing modal
          setIsEditing(false);
          setEditedContent('');
        }
        setMobileFileModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0" showCloseButton={false}>
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <File className={`w-5 h-5 flex-shrink-0 ${fileContent ? getFileIconColor(fileContent.name) : 'text-gray-500'}`} />
              <DialogTitle className="text-base truncate">{fileContent?.name || 'File'}</DialogTitle>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && !isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1"
                  onClick={handleStartEdit}
                >
                  <Edit3 className="w-3 h-3" />
                  {tCommon('edit')}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setMobileFileModalOpen(false)}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-[#0d1117]">
            {loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : fileContent ? (
              isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-transparent border-0 focus-visible:ring-0 resize-none text-white"
                  spellCheck={false}
                  autoFocus
                />
              ) : (
                <pre className="text-sm p-4">
                  <code
                    ref={codeRef}
                    className={`hljs language-${fileContent.language} block overflow-x-auto`}
                  >
                    {fileContent.content}
                  </code>
                </pre>
              )
            ) : null}
          </div>
          {fileContent && (
            <>
              {isEditing ? (
                <div className="p-3 border-t bg-muted/30 flex items-center justify-between gap-2">
                  {error && (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertCircle className="w-3 h-3" />
                      {error}
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <XIcon className="w-3 h-3 mr-1" />
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || !editedContent}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {tCommon('saving')}
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" />
                          {tCommon('save')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
                  <span className="capitalize">{fileContent.language}</span>
                  <span>{(fileContent.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
