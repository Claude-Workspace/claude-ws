#!/bin/bash
# Pre-publish testing script
# Tests the package locally before publishing to npm

set -e

echo "🧪 Starting pre-publish testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean previous builds
echo -e "\n${YELLOW}Step 1: Cleaning previous builds...${NC}"
rm -rf .next
rm -rf node_modules/.cache
rm -f *.tgz

# Step 2: Run linting
echo -e "\n${YELLOW}Step 2: Running linting checks...${NC}"
pnpm lint || echo -e "${YELLOW}⚠️  Linting warnings found (non-blocking)${NC}"

# Step 3: Build production bundle
echo -e "\n${YELLOW}Step 3: Building production bundle...${NC}"
NODE_ENV=production pnpm build

# Step 4: Create package tarball
echo -e "\n${YELLOW}Step 4: Creating package tarball...${NC}"
npm pack

# Get the tarball filename
TARBALL=$(ls -t *.tgz | head -1)
echo -e "${GREEN}✓ Created: $TARBALL${NC}"

# Step 5: Test installation in temp directory
echo -e "\n${YELLOW}Step 5: Testing installation in temporary directory...${NC}"
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

cd "$TEST_DIR"
echo -e "${YELLOW}Installing from tarball...${NC}"
npm install -g "$OLDPWD/$TARBALL"

# Step 6: Verify installation
echo -e "\n${YELLOW}Step 6: Verifying installation...${NC}"
if command -v claude-ws &> /dev/null; then
    VERSION=$(claude-ws --version)
    echo -e "${GREEN}✓ claude-ws is installed: $VERSION${NC}"
else
    echo -e "${RED}✗ claude-ws command not found${NC}"
    exit 1
fi

# Step 7: Test basic functionality
echo -e "\n${YELLOW}Step 7: Testing basic functionality...${NC}"
if claude-ws --help &> /dev/null; then
    echo -e "${GREEN}✓ Help command works${NC}"
else
    echo -e "${RED}✗ Help command failed${NC}"
    exit 1
fi

# Step 8: Cleanup
echo -e "\n${YELLOW}Step 8: Cleaning up...${NC}"
npm uninstall -g claude-ws
cd "$OLDPWD"
rm -rf "$TEST_DIR"

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All pre-publish tests passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\nPackage ready to publish: ${YELLOW}$TARBALL${NC}"
echo -e "\nTo publish, run:"
echo -e "  ${YELLOW}pnpm run publish:npm${NC}"
echo -e "\nOr publish the tarball directly:"
echo -e "  ${YELLOW}npm publish $TARBALL --access public${NC}"
