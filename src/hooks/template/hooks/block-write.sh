#!/bin/bash
# Hook: Block all file write operations without valid permission
# One-shot: permission is deleted immediately after one use

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_FILE=".claude/.session_permissions"

# Read current permission
PERMISSION=""
if [ -f "$SESSION_FILE" ]; then
  PERMISSION=$(cat "$SESSION_FILE" | tr -d '[:space:]')
fi

check_and_consume() {
  local required="$1"
  if [ "$PERMISSION" = "$required" ] || [ "$PERMISSION" = "write" ]; then
    # One-shot: delete permission immediately after use
    rm -f "$SESSION_FILE"
    exit 0
  else
    echo "❌ Blocked: Use /write to create files or /edit to modify files." >&2
    exit 2
  fi
}

case "$TOOL" in
  Write)
    check_and_consume "write"
    ;;
  Edit|MultiEdit)
    check_and_consume "edit"
    ;;
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

    # Whitelist: allow writing to permission file (created by /write and /edit)
    if echo "$CMD" | grep -qE '\.claude/\.session_permissions'; then
      exit 0
    fi

    if echo "$CMD" | grep -qE '( >| >>|tee |cp |mv |rm |mkdir |touch |chmod )'; then
      if [ -n "$PERMISSION" ]; then
        rm -f "$SESSION_FILE"
        exit 0
      else
        echo "❌ Blocked: This command can modify files. Use /write or /edit first." >&2
        exit 2
      fi
    fi
    ;;
esac

exit 0