#!/bin/bash
# Batch migrate remaining backend files to Pino logger

set -e

# Files to migrate with their module names
declare -A files=(
  ["src/lib/claude-code-settings.ts"]="ClaudeCodeSettings"
  ["src/lib/process-manager.ts"]="ProcessManager"
  ["src/lib/tunnel-service.ts"]="TunnelService"
  ["src/lib/sdk-event-adapter.ts"]="SDKAdapter"
  ["src/lib/git-snapshot.ts"]="GitSnapshot"
  ["src/lib/update-checker.ts"]="UpdateChecker"
  ["src/lib/file-processor.ts"]="FileProcessor"
  ["src/lib/context-tracker.ts"]="ContextTracker"
  ["src/lib/claude-dependency-analyzer.ts"]="DependencyAnalyzer"
  ["src/lib/session-manager.ts"]="SessionManager"
  ["src/lib/checkpoint-manager.ts"]="CheckpointManager"
  ["src/lib/anthropic-proxy-setup.ts"]="AnthropicProxy"
  ["src/lib/proxy-token-cache.ts"]="ProxyTokenCache"
  ["src/lib/install-script-generator.ts"]="InstallScriptGen"
  ["src/lib/usage-tracker.ts"]="UsageTracker"
  ["src/lib/output-formatter.ts"]="OutputFormatter"
  ["src/lib/workflow-tracker.ts"]="WorkflowTracker"
  ["src/lib/git-stats-collector.ts"]="GitStatsCollector"
  ["src/lib/dependency-extractor.ts"]="DependencyExtractor"
  ["src/lib/language-services/adapters/typescript-adapter.ts"]="TSAdapter"
)

for file in "${!files[@]}"; do
  module="${files[$file]}"

  if [ ! -f "$file" ]; then
    echo "Skipping $file (not found)"
    continue
  fi

  echo "Migrating $file (module: $module)"

  # Add import and logger instance if not already present
  if ! grep -q "createLogger" "$file"; then
    # Find first import line
    first_import=$(grep -n "^import " "$file" | head -1 | cut -d: -f1)

    if [ -n "$first_import" ]; then
      # Insert after last import
      last_import=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)
      sed -i "${last_import}a\\
import { createLogger } from '@/lib/logger';\\
\\
const log = createLogger('$module');" "$file"
    fi
  fi

  # Generic pattern replacements (most common patterns)
  sed -i -E \
    -e "s/console\.log\(\[\`\\[$module\\] /log.info(/g" \
    -e "s/console\.log\(\`\\[$module\\] ([^:]+): ([^:]+)\`\)/log.debug({ \2 }, '\1')/g" \
    -e "s/console\.log\(\`\\[$module\\] ([^']+)\`\)/log.debug('\1')/g" \
    -e "s/console\.error\(\`\\[$module\\] ([^:]+):\`, ([^)]+)\)/log.error({ err: \2 }, '\1')/g" \
    -e "s/console\.error\(\`\\[$module\\] ([^']+)\`\)/log.error('\1')/g" \
    -e "s/console\.warn\(\`\\[$module\\] ([^:]+):\`, ([^)]+)\)/log.warn({ err: \2 }, '\1')/g" \
    -e "s/console\.warn\(\`\\[$module\\] ([^']+)\`\)/log.warn('\1')/g" \
    "$file"
done

echo "Migration complete!"
