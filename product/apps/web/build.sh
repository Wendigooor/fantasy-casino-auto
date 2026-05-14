#!/bin/bash
cd /Users/iharzvezdzin/Documents/projects/hermes/test/puff/fantasy-casino-auto-main/product/apps/web && node ../../node_modules/.bin/vite build 2>&1
exit_code=$?
echo "BUILD_EXIT_CODE=$exit_code"
exit $exit_code
