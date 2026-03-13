#!/bin/bash
# SPIRAL config for fnb-online-ordering — Iteration 6
# See: C:\Users\Jyue\Documents\1-projects\Software Projects\Spiral\templates\spiral.config.example.sh

SPIRAL_PYTHON="python3"
SPIRAL_VALIDATE_CMD="npm run build && npm run lint && node scripts/run-tests.mjs"
SPIRAL_REPORTS_DIR="test-reports"
SPIRAL_STORY_PREFIX="US"
SPIRAL_MODEL_ROUTING="auto"
SPIRAL_FIRECRAWL_ENABLED=0
SPIRAL_RESEARCH_SPECIALIST_PROMPT=""
SPIRAL_RESEARCH_SPECIALIST_MODEL=""
SPIRAL_GEMINI_PROMPT="Focus on: POS system integration for F&B online ordering. Research the latest best practices for: (1) lightweight browser-based POS dashboards for restaurant staff, (2) PWA install prompts and background push notifications on Android, (3) Web Audio API for alarm/notification sounds in web apps, (4) real-time order escalation patterns in food delivery systems, (5) customer order tracking UX best practices (progress steppers, status pages). Provide actionable context for the implementation agent."
