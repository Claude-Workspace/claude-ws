# Command: Restore

## Name
`/antigravity restore`

## Description
Restore Claude.ws .env file from backup with version selection and rollback safety.

## Usage
```
/antigravity restore
```

## Parameters

### Required
None (will prompt for backup selection)

### Optional
- `--path <path>` - Custom backup directory (default: project root)
- `--list` - List all available backups
- `--force` - Skip confirmation prompt
- `--dry-run` - Preview without restoring

## Behavior

### Step 1: Check Backups
List all available .env.backup files with details (size, timestamp).

### Step 2: Select Backup
User selects which backup to restore.

### Step 3: Safety Check
Create backup of current .env before restoring.

### Step 4: Restore
Copy selected backup to .env.

### Step 5: Verify
Verify restore was successful and .env is valid.

## Output

### Success
```
=== Available Backups ===

1. .env.backup.20250203_095500
   - Size: 2.3 KB
   - Timestamp: 2025-02-03 09:55:00
   - Commit: feat: add Antigravity plugin

2. .env.backup.20250203_092000
   - Size: 2.1 KB
   - Timestamp: 2025-02-03 09:20:00
   - Commit: feat: add CLIProxyAPI OAuth

3. .env.backup.20250203_082000
   - Size: 1.9 KB
   - Timestamp: 2025-02-03 08:20:00
   - Commit: feat: add AuthDialog

Select backup to restore [1]: 2

=== Safety Check ===

✓ Backing up current .env...
✓ Backed up .env → .env.restore-backup.20250203_095700
✓ Size: 2.3 KB
✓ Timestamp: 2025-02-03 09:57:00

=== Restoring Environment ===

⚠ Warning: This will overwrite your current .env file

Restore from:
  - Timestamp: 2025-02-03 09:20:00
  - Commit: feat: add CLIProxyAPI OAuth

Current .env will be backed up:
  - To: .env.restore-backup.20250203_095700

Continue? [y/N]: y

✓ Backed up current .env → .env.restore-backup.20250203_095700
✓ Restored .env.backup.20250203_092000 → .env
✓ Size: 2.1 KB
✓ Original timestamp: 2025-02-03 09:20:00

✓ Environment restored successfully!

Next:
- /antigravity configure - Verify configuration
- /antigravity backup - Create new backup
- Check .env file: cat .env | grep ANTI_GRAVITY

Restore-backup preserved if needed:
- /antigravity restore --backup .env.restore-backup.20250203_095700
```

### List Backups Only
```bash
/antigravity restore --list

=== Available Backups ===

1. .env.backup.20250203_095500 (2.3 KB) - 2025-02-03 09:55:00
2. .env.backup.20250203_092000 (2.1 KB) - 2025-02-03 09:20:00
3. .env.backup.20250203_082000 (1.9 KB) - 2025-02-03 08:20:00

Total: 3 backups available
Next:
- /antigravity restore - Restore specific backup
- /antigravity restore --cleanup -- Remove old backups
```

### Dry Run
```bash
/antigravity restore --dry-run

=== Dry Run: Restore ===

Selected backup:
  - Source: .env.backup.20250203_092000
  - Timestamp: 2025-02-03 09:20:00
  - Size: 2.1 KB

Would restore to: .env
Would create safety backup: .env.restore-backup.20250203_095700

No changes were made.
This is a preview - run without --dry-run to actually restore.
```

## Options

### List Backups
```bash
/antigravity restore --list
```

### Restore from Specific Backup
```bash
/antigravity restore --backup .env.backup.20250203_095500
```

### Restore from Restore-Backup
```bash
# If you accidentally overwrote wrong backup, you can restore from the restore-backup
/antigravity restore --backup .env.restore-backup.20250203_095700
```

### Custom Backup Directory
```bash
/antigravity restore --path /custom/backups/
```

### Force Restore (Skip Confirmation)
```bash
/antigravity restore --force
```

### Cleanup Old Backups
```bash
# Remove backups older than N days
/antigravity restore --cleanup --days 7

# Keep last N backups
/antigravity restore --keep 5

# Remove all backups except latest
/antigravity restore --keep 1
```

## Error Handling

### No Backups Found
```bash
✗ No backups found
✗ Error: No .env.backup files in project directory

Please check:
- Project directory is correct
- Backups were created with /antigravity backup
- You're in the right directory

Next:
- /antigravity backup - Create a backup to restore
- Check /antigravity restore --list
```

### Backup File Not Found
```bash
✗ Backup file not found
✗ Error: ENOENT: no such file or directory

Please check:
- Backup filename is correct
- Run /antigravity restore --list to see available backups
- Check custom path if using --path
```

### Invalid Backup
```bash
✗ Invalid backup file
✗ Error: Backup file is corrupted or invalid format

Please check:
- Backup file integrity
- Run /antigravity restore --list
- Try a different backup
- Restore from original .env if available
```

### Write Error
```bash
✗ Failed to restore
✗ Error: EACCES: permission denied

Please check:
- File permissions for .env
- Disk space available
- Try with elevated permissions

Next:
- Check permissions: ls -la .env
- Fix permissions: chmod 600 .env
- Try again
```

## Implementation

### Backup List Structure
```javascript
interface BackupInfo {
  path: string;
  filename: string;
  timestamp: Date;
  size: number;
  commit?: string;
}
```

### Restore Process
```javascript
async function restoreBackup(backupPath, options = {}) {
  const {
    createSafetyBackup = true,
    verifyRestore = true
  } = options;

  try {
    // 1. Read backup file
    const backupData = await fs.promises.readFile(backupPath);

    // 2. Verify backup integrity
    if (verifyRestore) {
      await verifyBackupFormat(backupData);
    }

    // 3. Create safety backup of current .env
    if (createSafetyBackup) {
      await backupCurrentEnv({ timestamp: true });
    }

    // 4. Write backup to .env
    await fs.promises.writeFile('.env', backupData);

    // 5. Verify .env is valid
    const envData = await parseEnvFile('.env');
    await validateEnv(envData);

    return {
      success: true,
      restoredFrom: backupPath,
      safetyBackup: '.env.restore-backup',
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

### Backup Verification
```javascript
async function verifyBackupFormat(backupData) {
  const lines = backupData.toString().split('\n');
  
  // Check for valid .env format
  for (const line of lines) {
    if (line.trim() && !line.trim().startsWith('#') && !line.includes('=')) {
      throw new Error('Invalid .env format');
    }
  }
}
```

### Safety Backup Creation
```javascript
async function createSafetyBackup(sourcePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `.env.restore-backup.${timestamp}`;

  const stats = await fs.promises.stat(sourcePath);
  await fs.promises.copyFile(sourcePath, backupPath);

  return backupPath;
}
```

### Version Comparison
```javascript
async function compareBackups(backupPath1, backupPath2) {
  const stats1 = await fs.promises.stat(backupPath1);
  const stats2 = await fs.promises.stat(backupPath2);

  return {
    newer: stats1.mtimeMs > stats2.mtimeMs,
    larger: stats1.size > stats2.size,
    size1: stats1.size,
    size2: stats2.size,
    time1: stats1.mtimeMs,
    time2: stats2.mtimeMs
  };
}
```

## Usage Examples

### Simple Restore
```bash
/antigravity restore

=== Available Backups ===

1. .env.backup.20250203_095500 (2.3 KB) - 2025-02-03 09:55:00
2. .env.backup.20250203_092000 (2.1 KB) - 2025-02-03 09:20:00

Select backup to restore [1]: 2

⚠ Warning: This will overwrite your current .env
Restore from backup #2? [y/N]: y

✓ Backed up current .env → .env.restore-backup
✓ Restored .env.backup.20250203_092000 → .env
✓ Environment restored successfully!
```

### Restore Specific Backup
```bash
/antigravity restore --backup .env.backup.20250203_095500

✓ Backed up current .env → .env.restore-backup
✓ Restored .env.backup.20250203_095500 → .env
✓ Environment restored successfully!
```

### List Backups with Details
```bash
/antigravity restore --list --details

=== Available Backups ===

1. .env.backup.20250203_095500
   - Size: 2.3 KB
   - Timestamp: 2025-02-03 09:55:00 GMT+7
   - Commit: feat: add Antigravity plugin
   - Lines: 45

2. .env.backup.20250203_092000
   - Size: 2.1 KB
   - Timestamp: 2025-02-03 09:20:00 GMT+7
   - Commit: feat: add CLIProxyAPI OAuth
   - Lines: 42

3. .env.backup.20250203_082000
   - Size: 1.9 KB
   - Timestamp: 2025-02-03 08:20:00 GMT+7
   - Commit: feat: add AuthDialog

Total: 3 backups
Total size: 6.3 KB
```

### Restore with Force (Skip Confirmation)
```bash
/antigravity restore --backup .env.backup.20250203_092000 --force

✓ Restored .env.backup.20250203_092000 → .env
✓ No confirmation prompt (forced)
✓ Environment restored successfully!
```

### Cleanup Old Backups
```bash
# Keep last 3 backups, remove others
/antigravity restore --keep 3

=== Cleanup ===

✓ Removed .env.backup.20250203_082000 (older than last 3)

Keeping:
1. .env.backup.20250203_095500
2. .env.backup.20250203_092000
3. .env.backup.20250203_095500

Total: 3 backups
Total size: 6.3 KB
```

### Dry Run Preview
```bash
/antigravity restore --dry-run

=== Dry Run: Restore ===

Would restore: .env.backup.20250203_092000
Would create safety backup: .env.restore-backup.20250203_095700

No changes made.
This is a preview - run without --dry-run to actually restore.
```

## Testing

### Unit Tests
```javascript
describe('Restore Command', () => {
  it('should list available backups', async () => {
    const result = await handleRestore({});
    expect(result.backups).toBeDefined();
    expect(result.backups.length).toBeGreaterThan(0);
  });

  it('should restore from backup', async () => {
    // Create test backup
    await createTestBackup();

    // Restore from backup
    const result = await handleRestore({ backup: '.env.test.backup' });
    expect(result.success).toBe(true);
    expect(result.restoredFrom).toBe('.env.test.backup');
  });

  it('should create safety backup', async () => {
    const result = await handleRestore({ backup: '.env.test.backup' });
    expect(result.safetyBackup).toBeDefined();
    expect(await fileExists(result.safetyBackup)).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Restore Integration', () => {
  it('should restore and verify .env', async () => {
    // Create test backup
    const originalEnv = await readEnvFile('.env');

    // Restore from backup
    const result = await handleRestore({ backup: '.env.test.backup', force: true });
    expect(result.success).toBe(true);

    // Verify .env matches backup
    const restoredEnv = await readEnvFile('.env');
    expect(restoredEnv).toEqual(originalEnv);
  });

  it('should validate restored .env', async () => {
    const result = await handleRestore({ backup: '.env.valid.backup' });
    expect(result.success).toBe(true);

    // Validate .env format
    const env = await readEnvFile('.env');
    const validation = await validateEnv(env);
    expect(validation.valid).toBe(true);
  });
});
```

## Safety Measures

### Always Backup Before Restore
- ✅ Create safety backup of current .env
- ✅ Timestamp safety backups
- ✅ Keep multiple restore-backup chain

### Verification
- ✅ Verify backup file integrity before restore
- ✅ Validate .env format after restore
- ✅ Check for required variables

### Rollback Options
- ✅ Keep restore-backups for manual rollback
- ✅ Support multiple restore levels
- ✅ Easy undo/redo workflow

## Security

### File Permissions
- ✅ .env file: 0600 (read/write for owner only)
- ✅ Backup files: same as .env
- ✅ Restore-backup files: same as .env

### File Integrity
- ✅ Check backup file size matches original
- ✅ Verify .env format before restore
- ✅ Validate after restore

### Data Privacy
- ✅ Backup files contain sensitive tokens
- ✅ Include in .gitignore
- ✅ Never log .env contents
- ✅ Secure deletion of old backups

## Best Practices

### Before Restoring
```bash
# Always check current .env status
cat .env | grep ANTI_GRAVITY

# List available backups
/antigravity restore --list

# Verify backup integrity
/antigravity restore --verify .env.backup.20250203_095500
```

### After Restoring
```bash
# Verify .env was updated correctly
cat .env | grep ANTI_GRAVITY

# Test configuration
/antigravity configure --dry-run

# Verify provider connection
/antigravity oauth --provider claude --status
```

### Backup Management
```bash
# Regular cleanup
/antigravity restore --cleanup --days 30

# Keep last N backups
/antigravity restore --keep 5

# Monitor disk space
du -sh .env.backup* | head -20
```

## See Also

- `/antigravity backup` - Create environment backup
- `/antigravity configure` - Apply configuration
- `/antigravity oauth` - Authenticate with CLIProxyAPI

## License
MIT

## Credits
Created for Claude.ws by gh/bnopen (AiSon of gh/techcomthanh)
