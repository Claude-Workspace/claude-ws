# Command: Backup

## Name
`/antigravity backup`

## Description
Backup current Claude.ws .env file before making Antigravity/CLIProxyAPI plugin changes.

## Usage
```
/antigravity backup
```

## Parameters

### Optional
- `--path <path>` - Custom backup path (default: .env.backup)
- `--timestamp` - Add timestamp to filename (default: true)
- `--keep <number>` - Keep N most recent backups (default: 5)
- `--dry-run` - Preview without creating backup

## Behavior

### Step 1: Check .env Exists
Verify .env file exists in current directory.

### Step 2: Create Backup
Copy .env to backup location with timestamp.

### Step 3: Verify Backup
Verify backup was created successfully and has content.

### Step 4: Manage Old Backups
Delete old backups if exceeding keep limit.

## Output

### Success - Single Backup
```bash
/antigravity backup

=== Environment Backup ===

✓ Backed up .env → .env.backup
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:55:00

Your environment is safely backed up!

Next:
- /antigravity configure - Apply changes (will auto-backup)
- /antigravity restore - Rollback if needed
```

### Success - Timestamped Backup
```bash
/antigravity backup --timestamp

=== Environment Backup ===

✓ Backed up .env → .env.backup.20250203_095500
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:55:00

Your environment is safely backed up!

Next:
- /antigravity configure - Apply changes
- /antigravity restore - Select backup to restore
```

### Success - Custom Path
```bash
/antigravity backup --path /custom/backup/.env.backup

=== Environment Backup ===

✓ Backed up .env → /custom/backup/.env.backup
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:55:00

Your environment is safely backed up to custom path!

Next:
- /antigravity configure - Apply changes
- /antigravity restore --path /custom/backup/ - Restore from custom location
```

### Dry Run
```bash
/antigravity backup --dry-run

=== Dry Run: Environment Backup ===

Would backup:
  Source: .env
  Target: .env.backup.20250203_095500
  Size: 2.3 KB

No backup was created.
This is a preview - run without --dry-run to actually backup.
```

## Error Handling

### .env Not Found
```bash
✗ No .env file found
✗ Error: ENOENT: no such file or directory, .env

Please check:
- .env file exists in current directory
- You're in the correct project directory

Next:
- Create .env file with default configuration
- Or restore from existing backup: /antigravity restore
```

### Permission Denied
```bash
✗ Backup failed
✗ Error: EACCES: permission denied

Please check:
- File permissions for .env
- Write access to backup directory
- Try running with elevated permissions

Next:
- Check file permissions: ls -la .env
- Fix permissions: chmod 600 .env
- Try again
```

### Disk Full
```bash
✗ Backup failed
✗ Error: ENOSPC: no space left on device

Please check:
- Disk space available: df -h
- Clean up old backups: /antigravity backup --keep 3
- Clear other large files

Next:
- Free up disk space
- Try backup again
```

## Options

### Custom Backup Path
```bash
# Backup to custom location
/antigravity backup --path /backups/.env.backup

# Backup with timestamp in custom location
/antigravity backup --path /backups/ --timestamp
```

### Timestamp Control
```bash
# Add timestamp to filename (default)
/antigravity backup --timestamp

# Use sequential numbering
/antigravity backup --path /backups/backup_$(date +%s).env
```

### Backup Management
```bash
# Keep last N backups (default: 5)
/antigravity backup --keep 10

# Keep last 3 backups
/antigravity backup --keep 3

# Keep all backups (no deletion)
/antigravity backup --keep 0
```

### Dry Run
```bash
# Preview without creating backup
/antigravity backup --dry-run
```

## Implementation

### Backup File
```javascript
const fs = require('fs');
const path = require('path');

async function backupEnv(sourcePath, options = {}) {
  const {
    backupPath = '.env.backup',
    timestamp = true,
    keep = 5
  } = options;

  try {
    // Read source file
    const data = await fs.promises.readFile(sourcePath);
    const stats = await fs.promises.stat(sourcePath);

    // Generate backup filename
    const backupFile = timestamp
      ? `${backupPath}.${new Date().toISOString().replace(/[:.]/g, '-')}`
      : backupPath;

    // Write backup file
    await fs.promises.writeFile(backupFile, data);

    // Cleanup old backups
    if (keep > 0) {
      await cleanupOldBackups(backupPath, keep);
    }

    return {
      success: true,
      source: sourcePath,
      backupFile,
      size: stats.size,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}
```

### Cleanup Old Backups
```javascript
async function cleanupOldBackups(backupPath, keep) {
  const directory = path.dirname(backupPath);
  const baseName = path.basename(backupPath);
  const files = await fs.promises.readdir(directory);

  // Find all backup files
  const backups = files
    .filter(file => file.startsWith(baseName))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, -keep); // Keep N newest

  // Delete old backups
  for (const file of backups.slice(0, -keep)) {
    await fs.promises.unlink(path.join(directory, file));
  }

  return backups.length;
}
```

### Dry Run Mode
```javascript
async function dryRunBackup(sourcePath, options = {}) {
  const stats = await fs.promises.stat(sourcePath);
  const backupFile = generateBackupPath(options);

  return {
    success: true,
    dryRun: true,
    wouldBackup: sourcePath,
    wouldTarget: backupFile,
    wouldSize: stats.size,
    timestamp: new Date().toISOString()
  };
}
```

## Usage Examples

### Basic Backup
```bash
/antigravity backup

=== Environment Backup ===

✓ Backed up .env → .env.backup
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:55:00

Your environment is safely backed up!

Next:
- /antigravity configure - Apply changes
```

### Timestamped Backup
```bash
/antigravity backup --timestamp

=== Environment Backup ===

✓ Backed up .env → .env.backup.20250203-095500
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:55:00

Next:
- /antigravity list backups - View all backups
- /antigravity restore - Select specific backup
```

### Keep Multiple Backups
```bash
# Keep last 10 backups
/antigravity backup --keep 10

=== Environment Backup ===

✓ Backed up .env → .env.backup
✓ Cleaned up 5 old backups
✓ Keeping last 10 backups

Next:
- /antigravity configure - Safe to make changes
```

### Backup to Custom Location
```bash
# Backup to custom directory
/antigravity backup --path /backups/.env.backup

=== Environment Backup ===

✓ Backed up .env → /backups/.env.backup
✓ Size: 2.3 KB
✓ Custom location: /backups/

Next:
- /antigravity configure - Apply changes
- /antigravity restore --path /backups/ - Restore from custom location
```

### Dry Run Preview
```bash
/antigravity backup --dry-run

=== Dry Run: Environment Backup ===

Would backup:
  Source: .env
  Target: .env.backup.20250203_095500
  Size: 2.3 KB

No backup was created.
This is a preview - run without --dry-run to actually backup.

Next:
- /antigravity backup - Create actual backup
- /antigravity configure - Make changes
```

## Best Practices

### Before Making Changes
```bash
# Always backup before configuration changes
/antigravity backup

# Verify backup was successful
ls -la .env.backup*

# Then configure
/antigravity configure
```

### Backup Management
```bash
# Keep reasonable number of backups
/antigravity backup --keep 5

# Regular cleanup
/antigravity backup --keep 5

# Monitor disk space
du -sh .env.backup*
```

### Security
- ✅ Backup files have same permissions as .env
- ✅ Backups stored in project directory (not exposed)
- ✅ Backup files included in .gitignore
- ✅ Sensitive data never logged

### Recovery
- ✅ Keep multiple timestamped backups
- ✅ Easy restore from any backup
- ✅ Dry run mode for preview
- ✅ Safe cleanup of old backups

## See Also

- `/antigravity restore` - Restore from backup
- `/antigravity list backups` - List all available backups
- `/antigravity configure` - Apply changes (auto-backup)
- `/antigravity backup --clean` - Remove all backups

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)
