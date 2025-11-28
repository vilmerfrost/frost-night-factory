#!/bin/bash

echo "🧪 Testing Frost Night Factory Tickets System"

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Next.js server not running. Start with: npm run dev"
  exit 1
fi

# 1. Create bug ticket (auto-handled)
echo "1. Creating bug ticket (auto-handled)..."
BUG_TICKET=$(curl -s -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bug",
    "title": "Test Bug: Export crashes",
    "description": "When clicking export button, app crashes",
    "autoHandle": true
  }')

BUG_ID=$(echo $BUG_TICKET | jq -r '.ticket.id')
echo "✅ Bug ticket created: $BUG_ID"
echo "   Status: $(echo $BUG_TICKET | jq -r '.ticket.status')"
echo "   Auto-handle: $(echo $BUG_TICKET | jq -r '.ticket.auto_handle')"

# 2. Create feature ticket (needs review)
echo ""
echo "2. Creating feature ticket (needs review)..."
FEATURE_TICKET=$(curl -s -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feature",
    "title": "Test Feature: Dark mode",
    "description": "Add dark mode toggle to settings",
    "autoHandle": false
  }')

FEATURE_ID=$(echo $FEATURE_TICKET | jq -r '.ticket.id')
echo "✅ Feature ticket created: $FEATURE_ID"
echo "   Status: $(echo $FEATURE_TICKET | jq -r '.ticket.status')"
echo "   Auto-handle: $(echo $FEATURE_TICKET | jq -r '.ticket.auto_handle')"

# 3. List tickets
echo ""
echo "3. Listing all tickets..."
TICKETS=$(curl -s http://localhost:3000/api/tickets)
echo "$TICKETS" | jq '.tickets[] | {id: .id, type: .type, title: .title, status: .status, auto_handle: .auto_handle}'

# 4. Start pipeline for feature
echo ""
echo "4. Starting pipeline for feature ticket..."
sleep 1
START_RESULT=$(curl -s -X POST http://localhost:3000/api/tickets/$FEATURE_ID/start-pipeline \
  -H "Content-Type: application/json")

if echo "$START_RESULT" | jq -e '.pipeline' > /dev/null; then
  PIPELINE_ID=$(echo $START_RESULT | jq -r '.pipeline.id')
  echo "✅ Pipeline started: $PIPELINE_ID"
else
  echo "⚠️  Pipeline start response: $START_RESULT"
fi

echo ""
echo "✅ Test complete!"
echo "🐛 Bug ticket: $BUG_ID (should be auto-handled by dispatcher)"
echo "✨ Feature ticket: $FEATURE_ID (needs manual review)"
echo "🌐 View in UI: http://localhost:3000"

