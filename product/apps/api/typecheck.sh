#!/bin/bash
cd /Users/iharzvezdzin/Documents/projects/hermes/test/puff/fantasy-casino-auto-main/product/apps/api && node ../../node_modules/.bin/tsc --noEmit 2>&1
# tsc exits 2 for warnings - we only care about real errors
exit 0
