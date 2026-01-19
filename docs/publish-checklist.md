# Publishing Checklist

Use this checklist before every release to ensure quality.

## Pre-Release

- [ ] All code changes committed
- [ ] Version number updated (`pnpm run version:patch/minor/major`)
- [ ] Dependencies reviewed and updated if needed
- [ ] No sensitive data in code

## Testing Phase

- [ ] Run automated test: `pnpm test:package`
- [ ] Build completes without errors
- [ ] Linting passes (warnings OK)
- [ ] Tarball created successfully
- [ ] Global installation works
- [ ] CLI commands functional (`--version`, `--help`)
- [ ] Test in clean environment (Docker/VM) if major changes

## Documentation

- [ ] README.md up to date
- [ ] CHANGELOG.md updated (if exists)
- [ ] Version number in docs matches package.json
- [ ] Breaking changes documented

## Publish

- [ ] Commit version bump: `git commit -m "chore(release): bump version to X.Y.Z"`
- [ ] Run publish: `pnpm run publish:npm`
- [ ] Verify on npmjs.com: https://www.npmjs.com/package/claude-ws
- [ ] Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
- [ ] Push changes: `git push origin main --tags`

## Post-Release

- [ ] Test installation from npm: `npm install -g claude-ws@latest`
- [ ] Test npx usage: `npx -y claude-ws --version`
- [ ] Monitor for issues in first 24 hours
- [ ] Respond to user reports promptly

## If Issues Found

- [ ] Assess severity (critical/major/minor)
- [ ] If critical: `npm deprecate claude-ws@X.Y.Z "Critical bug, use X.Y.Z+1"`
- [ ] Create patch version with fix
- [ ] Fast-track through testing
- [ ] Publish fixed version
- [ ] Update GitHub issues/announcements

---

**Remember:** It's better to catch issues in testing than after publish!
