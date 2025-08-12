#!/bin/bash

# Code Quality Validation Script
# This script provides an easy way to validate code quality across the entire monorepo

set -e

echo "🔍 Starting Code Quality Validation for Agentic Workflow Monorepo..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run command and capture output
run_check() {
    local check_name="$1"
    local command="$2"
    
    print_status "Running $check_name..."
    
    if eval "$command" > /tmp/check_output 2>&1; then
        print_success "$check_name passed"
        return 0
    else
        print_error "$check_name failed"
        echo "Error output:"
        cat /tmp/check_output
        return 1
    fi
}

# Initialize error tracking
errors=0

# 1. ESLint Check
echo ""
print_status "Step 1: ESLint Validation"
if run_check "ESLint" "pnpm lint"; then
    :
else
    print_error "ESLint found issues. Run 'pnpm lint:fix' to auto-fix or manually resolve."
    ((errors++))
fi

# 2. TypeScript Type Check
echo ""
print_status "Step 2: TypeScript Type Checking"
if run_check "TypeScript" "pnpm type-check"; then
    :
else
    print_error "TypeScript found type errors. Please fix all type issues."
    ((errors++))
fi

# 3. Prettier Format Check
echo ""
print_status "Step 3: Prettier Format Validation"
if run_check "Prettier" "pnpm format:check"; then
    :
else
    print_error "Code formatting issues found. Run 'pnpm format' to fix."
    ((errors++))
fi

# 4. Build Check (if build script exists)
echo ""
print_status "Step 4: Build Validation"
if pnpm run build > /dev/null 2>&1; then
    print_success "Build validation passed"
else
    print_warning "Build script not available or failed (non-blocking)"
fi

# 5. Package Dependencies Check
echo ""
print_status "Step 5: Package Dependencies Check"
if run_check "Package Dependencies" "pnpm tools:package-check"; then
    :
else
    print_warning "Package dependency issues found (non-blocking)"
fi

# Summary
echo ""
echo "=================================================="
if [ $errors -eq 0 ]; then
    print_success "🎉 All Code Quality Checks Passed!"
    echo ""
    echo -e "${GREEN}✅ ESLint: No errors${NC}"
    echo -e "${GREEN}✅ TypeScript: No type errors${NC}"
    echo -e "${GREEN}✅ Prettier: Properly formatted${NC}"
    echo -e "${GREEN}✅ Ready for commit!${NC}"
    exit 0
else
    print_error "❌ $errors Code Quality Check(s) Failed"
    echo ""
    echo "Please fix the issues above before committing."
    echo ""
    echo "Quick fixes:"
    echo "  - Run 'pnpm lint:fix' for auto-fixable ESLint issues"
    echo "  - Run 'pnpm format' for formatting issues"
    echo "  - Manually fix TypeScript errors"
    echo ""
    echo "Then re-run this script to validate."
    exit 1
fi