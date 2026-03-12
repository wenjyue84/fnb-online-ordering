#!/bin/bash
# SPIRAL config for fnb-online-ordering
# See: C:\Users\Jyue\Documents\1-projects\Software Projects\Spiral\templates\spiral.config.example.sh

SPIRAL_PYTHON="python3"
SPIRAL_VALIDATE_CMD="npm run build && npm run lint && node scripts/run-tests.mjs"
SPIRAL_REPORTS_DIR="test-reports"
SPIRAL_STORY_PREFIX="US"
SPIRAL_MODEL_ROUTING="auto"
SPIRAL_FIRECRAWL_ENABLED=0
SPIRAL_RESEARCH_SPECIALIST_PROMPT=""
SPIRAL_RESEARCH_SPECIALIST_MODEL=""
