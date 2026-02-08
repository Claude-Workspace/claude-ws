// TypeScript/JavaScript language adapter using TypeScript Compiler API

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../logger';

const log = createLogger('TSAdapter');

import type {
  LanguageAdapter,
  ResolveParams,
  DefinitionResult,
  SymbolKind,
} from '../types';

// Cache for language services per project
const serviceCache = new Map<string, {
  service: ts.LanguageService;
  files: Map<string, { version: number; content: string }>;
  lastAccess: number;
}>();

// Cache cleanup interval (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_CLEANUP_INTERVAL = 60 * 1000;

// Start cache cleanup timer
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of serviceCache.entries()) {
      if (now - value.lastAccess > CACHE_TTL) {
        serviceCache.delete(key);
      }
    }
  }, CACHE_CLEANUP_INTERVAL);
}

/**
 * Read tsconfig.json and create compiler options
 */
function getCompilerOptions(basePath: string): ts.CompilerOptions {
  const configPath = ts.findConfigFile(basePath, ts.sys.fileExists, 'tsconfig.json');

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.config) {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );
      return parsed.options;
    }
  }

  // Default options if no tsconfig found
  return {
    allowJs: true,
    checkJs: true,
    jsx: ts.JsxEmit.React,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    esModuleInterop: true,
    strict: false,
    skipLibCheck: true,
    baseUrl: basePath,
    paths: {
      '@/*': ['./src/*'],
    },
  };
}

/**
 * Create or get cached language service for a project
 */
function getLanguageService(basePath: string): {
  service: ts.LanguageService;
  files: Map<string, { version: number; content: string }>;
} {
  // Check cache
  const cached = serviceCache.get(basePath);
  if (cached) {
    cached.lastAccess = Date.now();
    return { service: cached.service, files: cached.files };
  }

  startCleanupTimer();

  const compilerOptions = getCompilerOptions(basePath);
  const files = new Map<string, { version: number; content: string }>();

  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => Array.from(files.keys()),
    getScriptVersion: (fileName) => {
      const file = files.get(fileName);
      return file ? String(file.version) : '0';
    },
    getScriptSnapshot: (fileName) => {
      // Check cached files first
      const cached = files.get(fileName);
      if (cached) {
        return ts.ScriptSnapshot.fromString(cached.content);
      }

      // Read from disk
      if (!fs.existsSync(fileName)) {
        return undefined;
      }
      const content = fs.readFileSync(fileName, 'utf-8');
      files.set(fileName, { version: 1, content });
      return ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => basePath,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

  // Cache the service
  serviceCache.set(basePath, {
    service,
    files,
    lastAccess: Date.now(),
  });

  return { service, files };
}

/**
 * Convert TypeScript ScriptElementKind to our SymbolKind
 */
function convertKind(tsKind: ts.ScriptElementKind): SymbolKind {
  switch (tsKind) {
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.localFunctionElement:
      return 'function';
    case ts.ScriptElementKind.classElement:
      return 'class';
    case ts.ScriptElementKind.interfaceElement:
      return 'interface';
    case ts.ScriptElementKind.typeElement:
      return 'type';
    case ts.ScriptElementKind.constElement:
      return 'const';
    case ts.ScriptElementKind.letElement:
      return 'let';
    case ts.ScriptElementKind.variableElement:
      return 'variable';
    case ts.ScriptElementKind.enumElement:
      return 'enum';
    case ts.ScriptElementKind.moduleElement:
      return 'module';
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.memberGetAccessorElement:
    case ts.ScriptElementKind.memberSetAccessorElement:
      return 'property';
    case ts.ScriptElementKind.memberFunctionElement:
      return 'method';
    case ts.ScriptElementKind.parameterElement:
      return 'parameter';
    default:
      return 'unknown';
  }
}

/**
 * Extract code preview from a file
 */
function getCodePreview(
  filePath: string,
  startLine: number,
  endLine: number,
  maxLines: number = 15
): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Expand preview to show context
    const previewStart = Math.max(0, startLine - 1);
    const previewEnd = Math.min(lines.length, Math.max(endLine, startLine + maxLines));

    return lines.slice(previewStart, previewEnd).join('\n');
  } catch {
    return '';
  }
}

/**
 * Get language string from file path
 */
function getLanguageFromFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (['.ts', '.mts', '.cts'].includes(ext)) return 'typescript';
  if (['.tsx'].includes(ext)) return 'typescriptreact';
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (['.jsx'].includes(ext)) return 'javascriptreact';
  return 'typescript';
}

/**
 * TypeScript/JavaScript Language Adapter
 */
export class TypeScriptAdapter implements LanguageAdapter {
  readonly language = 'typescript';
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'] as const;
  readonly displayName = 'TypeScript/JavaScript';

  async isAvailable(): Promise<boolean> {
    // TypeScript is always available since we're importing it directly
    return true;
  }

  async resolveDefinition(params: ResolveParams): Promise<DefinitionResult> {
    const { basePath, filePath, line, column, fileContent } = params;

    try {
      // Get or create language service
      const { service, files } = getLanguageService(basePath);

      // Resolve full file path
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(basePath, filePath);

      // Update file content if provided
      if (fileContent) {
        const existing = files.get(fullPath);
        files.set(fullPath, {
          version: (existing?.version ?? 0) + 1,
          content: fileContent,
        });
      } else if (!files.has(fullPath)) {
        // Read file if not in cache
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.set(fullPath, { version: 1, content });
        } else {
          return { found: false, error: 'File not found' };
        }
      }

      // Get file content for position calculation
      const file = files.get(fullPath);
      if (!file) {
        return { found: false, error: 'File not found' };
      }

      // Convert line/column to position
      const lines = file.content.split('\n');
      let position = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) {
        position += lines[i].length + 1; // +1 for newline
      }
      position += column;

      // Get definition at position
      const definitions = service.getDefinitionAtPosition(fullPath, position);

      if (!definitions || definitions.length === 0) {
        return { found: false, error: 'Definition not found' };
      }

      // Use the first definition
      const def = definitions[0];
      const defFilePath = def.fileName;

      // Get position info
      const defSourceFile = service.getProgram()?.getSourceFile(defFilePath);
      let defLine = 1;
      let defColumn = 0;
      let defEndLine = 1;
      let defEndColumn = 0;

      if (defSourceFile) {
        const startPos = defSourceFile.getLineAndCharacterOfPosition(def.textSpan.start);
        const endPos = defSourceFile.getLineAndCharacterOfPosition(
          def.textSpan.start + def.textSpan.length
        );
        defLine = startPos.line + 1;
        defColumn = startPos.character;
        defEndLine = endPos.line + 1;
        defEndColumn = endPos.character;
      }

      // Get symbol info for kind
      const quickInfo = service.getQuickInfoAtPosition(fullPath, position);
      const kind = quickInfo?.kind ? convertKind(quickInfo.kind) : 'unknown';

      // Get symbol name
      const symbolName = def.name || params.symbol;

      // Get relative path if within project, otherwise use full path
      let resultPath = defFilePath;
      if (defFilePath.startsWith(basePath)) {
        resultPath = path.relative(basePath, defFilePath);
      }

      // Generate preview
      const preview = getCodePreview(defFilePath, defLine, defEndLine);
      const previewLanguage = getLanguageFromFile(defFilePath);

      return {
        found: true,
        definition: {
          filePath: resultPath,
          line: defLine,
          column: defColumn,
          endLine: defEndLine,
          endColumn: defEndColumn,
          symbol: symbolName,
          kind,
        },
        preview: preview ? {
          content: preview,
          startLine: defLine,
          endLine: Math.min(defLine + 14, defEndLine + 5),
          language: previewLanguage,
        } : undefined,
      };
    } catch (error) {
      log.error({ error: error }, 'TypeScript adapter error:');
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  dispose(): void {
    // Clear the cache for this adapter
    serviceCache.clear();
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }
}

// Export singleton instance
export const typescriptAdapter = new TypeScriptAdapter();
