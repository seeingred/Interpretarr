#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="release/interpretarr-${VERSION}"

echo "Building Interpretarr v${VERSION}..."

# Clean
rm -rf release/

# Build
npm run build

# Create release directory
mkdir -p "${RELEASE_DIR}"

# Copy built files
cp -r dist/ "${RELEASE_DIR}/dist/"
cp -r client/dist/ "${RELEASE_DIR}/client/dist/"
cp package.json "${RELEASE_DIR}/"
cp package-lock.json "${RELEASE_DIR}/"

# Install production dependencies
cd "${RELEASE_DIR}"
npm ci --production --ignore-scripts
cd ../..

# Create data directory
mkdir -p "${RELEASE_DIR}/data"

# Create start script
cat > "${RELEASE_DIR}/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node dist/server/index.js
EOF
chmod +x "${RELEASE_DIR}/start.sh"

# Create Windows start script
cat > "${RELEASE_DIR}/start.bat" << 'EOF'
@echo off
cd /d "%~dp0"
node dist\server\index.js
EOF

# Create archive
cd release/
tar -czf "interpretarr-${VERSION}.tar.gz" "interpretarr-${VERSION}/"
echo "Release package created: release/interpretarr-${VERSION}.tar.gz"
