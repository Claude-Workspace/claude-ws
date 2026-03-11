/**
 * Public API - exports createApp factory, config loader, shared modules, and all service factories
 */
export { createApp } from './app-factory';
export { loadEnvConfig, type EnvConfig } from './config/env-config';

// Shared modules - re-exported for use by claude-ws via @agentic-sdk/* path alias
export { createLogger, logger, type Logger } from './lib/pino-logger';
export {
  type Model,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_ALIAS,
  getModelById,
  isValidModelId,
  modelIdToDisplayName,
  getModelShortName,
} from './lib/claude-available-models';
export { safeCompare } from './lib/timing-safe-compare';

// --- Projects ---
export { createProjectService } from './services/project-crud-service';

// --- Tasks ---
export { createTaskService } from './services/task-crud-and-reorder-service';

// --- Attempts ---
export { createAttemptService } from './services/attempt-crud-and-logs-service';
export { createUploadService } from './services/attempt-file-upload-storage-service';

// --- Checkpoints ---
export { createCheckpointService } from './services/checkpoint-crud-and-rewind-service';
export { createCheckpointOperationsService } from './services/checkpoint-fork-and-rewind-operations-service';

// --- Files ---
export { createFileService } from './services/filesystem-read-write-service';
export { createFileOperationsService } from './services/file-operations-and-upload-service';
export { createFileContentReadWriteService, type FileContentResult } from './services/file-content-read-write-service';
export {
  createFileTreeAndContentService,
} from './services/file-tree-and-content-service';
export {
  createFileTreeBuilderService,
  type GitFileStatusCode,
  type FileEntry,
  type FileTreeResult,
} from './services/file-tree-builder-service';
export {
  LANGUAGE_MAP,
  BINARY_EXTENSIONS,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  MAX_FILE_SIZE,
  CONTENT_TYPE_MAP,
  getContentTypeForExtension,
  detectLanguage,
} from './services/file-mime-and-language-constants';

// --- Search ---
export { createSearchService } from './services/content-search-and-file-glob-service';
export { createFileSearchService } from './services/file-search-and-content-search-service';
export { createChatHistorySearchService } from './services/chat-history-search-service';

// --- Shells ---
export { createShellService } from './services/shell-process-db-tracking-service';

// --- Commands ---
export {
  createCommandService,
  type CommandInfo,
  type CommandContent,
  type ProcessedCommand,
} from './services/slash-command-listing-service';

// --- Force-create helpers ---
export {
  createForceCreateService,
  ForceCreateError,
  sanitizeDirName,
  type ForceCreateParams,
  type ForceCreateResult,
} from './services/force-create-project-and-task-service';

// --- Agent Factory ---
export { createAgentFactoryService } from './services/agent-factory-plugin-registry-service';
export { createAgentFactoryProjectSyncService } from './services/agent-factory-project-sync-and-install-service';
export {
  createAgentFactoryFilesystemService,
  type FileNode,
  type DiscoveredItem,
  type DiscoveredFolder,
} from './services/agent-factory-plugin-filesystem-operations-service';
