#!/bin/bash
set -e

echo "Running tests with JSON reporter..."
pnpm turbo test --force

echo "Test results available in:"
find . -name "test-results.json" -type f | grep -v node_modules

echo "Done."
