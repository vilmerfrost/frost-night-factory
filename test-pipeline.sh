#!/bin/bash

echo "🧪 Testing Frost Night Factory Pipeline"

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Next.js server not running. Start with: npm run dev"
  exit 1
fi

# 1. Create pipeline
echo "1. Creating pipeline..."
PIPELINE=$(curl -s -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "ideaPrompt": "Build a simple counter app with Next.js and Tailwind"
  }')

PIPELINE_ID=$(echo $PIPELINE | jq -r '.pipeline.id')

if [ "$PIPELINE_ID" == "null" ] || [ -z "$PIPELINE_ID" ]; then
  echo "❌ Failed to create pipeline"
  echo "Response: $PIPELINE"
  exit 1
fi

echo "✅ Pipeline created: $PIPELINE_ID"

# 2. Check status
echo ""
echo "2. Checking pipeline status..."
sleep 2
STATUS=$(curl -s http://localhost:3000/api/pipelines | jq -r '.pipelines[] | select(.id=="'$PIPELINE_ID'") | .status')
PHASE=$(curl -s http://localhost:3000/api/pipelines | jq -r '.pipelines[] | select(.id=="'$PIPELINE_ID'") | .current_phase')

echo "   Status: $STATUS"
echo "   Phase: $PHASE"

# 3. Check steps
echo ""
echo "3. Checking pipeline steps..."
STEPS=$(curl -s http://localhost:3000/api/pipelines/$PIPELINE_ID/steps)
echo "$STEPS" | jq '.steps[] | {phase: .phase, status: .status}'

echo ""
echo "✅ Test complete!"
echo "📝 Pipeline ID: $PIPELINE_ID"
echo "🚀 Check runner logs for progress"
echo "🌐 View in UI: http://localhost:3000"

