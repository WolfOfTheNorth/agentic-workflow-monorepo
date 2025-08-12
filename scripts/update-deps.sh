#!/bin/bash

# Manual dependency update script
# Run this periodically instead of using Dependabot

set -e

echo "🔍 Checking for outdated dependencies..."

# Check outdated packages
echo "📦 Checking outdated npm packages..."
pnpm outdated || true

echo "🐍 Checking outdated Python packages..."
cd apps/backend
pip list --outdated || true
cd ../..

echo ""
echo "🔧 To update dependencies manually:"
echo "  1. Review the outdated packages above"
echo "  2. Update specific packages: pnpm update <package-name>"
echo "  3. Test thoroughly: pnpm check && pnpm test"
echo "  4. Commit changes if all tests pass"
echo ""
echo "🛡️  For security updates only:"
echo "  pnpm audit --fix"
echo ""
echo "💡 This gives you control over when and what to update!"