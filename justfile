# AI Life OS — Task Runner
# Cross-platform task orchestration for AI-assisted development

# Windows PowerShell compatibility
set windows-shell := ["powershell", "-NoLogo", "-Command"]

# Default recipe: show available commands
default:
    @just --list

# Complete feature workflow: verify + build
feature: verify build
    @echo "Feature complete!"

# Run full verification (type-check + lint + test)
verify:
    pnpm turbo run ai:verify

# Type check all packages
type-check:
    pnpm turbo run type-check

# Lint all packages
lint:
    pnpm turbo run lint

# Run tests across all packages
test:
    pnpm turbo run test

# Build all packages
build:
    pnpm turbo run build

# Generate code (Supabase types, etc.)
generate:
    pnpm db:generate

# Generate Zod contracts from documentation
generate-contracts:
    pnpm zod:generate

# Clean build artifacts
clean:
    pnpm turbo run clean --force
    rm -rf node_modules/.cache

# Install dependencies
install:
    pnpm install

# Run doc-sync to update CLAUDE.md/README.md hierarchy
docs:
    @echo "Use 'doc-sync' skill in Claude Code to sync documentation"
