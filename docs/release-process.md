# Release Process Guide

## Pre-Publish Testing Workflow

Before publishing any new version to npm, **always** run the pre-publish test script to catch issues early.

### Quick Test

```bash
# Run the automated test script
./scripts/test-package.sh
```

This script will:
1. Clean previous builds
2. Run linting checks
3. Build production bundle
4. Create package tarball
5. Test installation in temp directory
6. Verify CLI commands work
7. Cleanup and report results

### Manual Testing Steps

If you prefer manual testing or need deeper verification:

#### 1. Build and Pack

```bash
# Clean build
rm -rf .next node_modules/.cache

# Production build
NODE_ENV=production pnpm build

# Create tarball
npm pack
```

#### 2. Test Local Installation

```bash
# Install from tarball globally
npm install -g ./claude-ws-0.1.x.tgz

# Test the CLI
claude-ws --version
claude-ws --help

# Try running it
cd ~/test-project
claude-ws
```

#### 3. Test npx Usage

```bash
# Clean install test
npx -y ./claude-ws-0.1.x.tgz
```

#### 4. Test in Fresh Environment (Recommended)

Using Docker for isolated testing:

```bash
# Create test Dockerfile
cat > Dockerfile.test <<EOF
FROM node:20-alpine
RUN apk add --no-cache git
COPY claude-ws-0.1.x.tgz /tmp/
RUN npm install -g /tmp/claude-ws-0.1.x.tgz
CMD ["claude-ws", "--version"]
EOF

# Build and test
docker build -f Dockerfile.test -t claude-ws-test .
docker run --rm claude-ws-test
```

#### 5. Clean Up

```bash
# Remove global installation
npm uninstall -g claude-ws

# Remove tarball
rm -f *.tgz
```

## Publishing Workflow

### 1. Update Version

```bash
# Patch version (bug fixes)
pnpm run version:patch

# Minor version (new features)
pnpm run version:minor

# Major version (breaking changes)
pnpm run version:major
```

### 2. Run Pre-Publish Tests

```bash
./scripts/test-package.sh
```

### 3. Commit Version Bump

```bash
git add package.json
git commit -m "chore(release): bump version to X.Y.Z"
```

### 4. Publish to npm

```bash
pnpm run publish:npm
```

### 5. Create Git Tag

```bash
# Get current version
VERSION=$(node -p "require('./package.json').version")

# Create and push tag
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
git push origin main
```

## Beta/Pre-release Testing

For testing beta versions before stable release:

### 1. Create Beta Version

```bash
# First time beta
npm version prerelease --preid=beta --no-git-tag-version
# Result: 0.1.13 -> 0.1.14-beta.0

# Subsequent beta versions
npm version prerelease --no-git-tag-version
# Result: 0.1.14-beta.0 -> 0.1.14-beta.1
```

### 2. Publish Beta

```bash
npm publish --tag beta --access public
```

### 3. Install Beta Version

```bash
# Install specific beta
npm install -g claude-ws@0.1.14-beta.0

# Install latest beta
npm install -g claude-ws@beta
```

### 4. Promote Beta to Stable

```bash
# Update version to stable
npm version patch --no-git-tag-version
# Result: 0.1.14-beta.1 -> 0.1.14

# Publish as latest
pnpm run publish:npm
```

## Common Issues and Fixes

### Build Errors

```bash
# Clear all caches
rm -rf .next node_modules/.cache
pnpm install --force
pnpm build
```

### Dependency Issues

```bash
# Check for missing peer dependencies
pnpm install --fix-lockfile

# Verify dependencies are in correct section
# - Runtime dependencies: dependencies
# - Build-time dependencies: dependencies (if needed for postinstall)
# - Dev-only dependencies: devDependencies
```

### npm Update Errors

If users report `npm update -g claude-ws` errors:

1. Test with npm (not pnpm):
```bash
npm cache clean --force
npm install -g ./claude-ws-0.1.x.tgz
```

2. Verify package.json structure:
   - No `packageManager` field (causes conflicts)
   - `postinstall` script handles build errors gracefully
   - All runtime deps in `dependencies`

## Checklist Before Publishing

- [ ] Run `./scripts/test-package.sh` successfully
- [ ] Test npm install from tarball
- [ ] Test npx usage
- [ ] Verify CLI commands work
- [ ] Check build size is reasonable
- [ ] Update CHANGELOG.md (if exists)
- [ ] Commit version bump
- [ ] Publish to npm
- [ ] Create git tag
- [ ] Test installation from npm registry

## Rollback Process

If a published version has critical bugs:

### 1. Deprecate Bad Version

```bash
npm deprecate claude-ws@0.1.x "Critical bug, please use 0.1.y instead"
```

### 2. Publish Fixed Version

```bash
pnpm run version:patch
# Fix the bugs
./scripts/test-package.sh
pnpm run publish:npm
```

### 3. Notify Users

- Update GitHub README
- Create GitHub issue
- Post announcement if applicable
