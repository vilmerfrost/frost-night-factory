# Frost Night Factory Agent Runner

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Start the runner
npm start
```

## 📋 Environment Variables

See `.env.example` for all required API keys.

**Critical:**
- `ANTHROPIC_API_KEY` - Required for Coder, Vision Refinement
- `SUPABASE_SERVICE_ROLE_KEY` - Required for pipeline runner
- `GOOGLE_API_KEY` - Required for Prompt Engineer
- `DEEPSEEK_API_KEY` - Required for Planner
- `GROQ_API_KEY` - Required for Code Reviewer
- `MOONSHOT_API_KEY` - Required for Research Synthesis

## 🛠️ Available Scripts

- `npm start` - Start pipeline runner
- `npm run dev` - Development mode (auto-reload)
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:contracts` - Run Pact contract tests
- `npm run audit:performance` - Run Lighthouse audit
- `npm run costs:report` - View cost statistics
- `npm run playwright:install` - Install Playwright browsers

## 🔧 Feature Flags

Control features via `lib/version-manager.ts` or environment variables:

```bash
FEATURE_RUNVISIONREFINEMENT=true
FEATURE_RUNPLAYWRIGHTTESTS=true
FEATURE_ENABLEABTESTING=false
```

## 📊 Cost Tracking

Costs are automatically tracked and saved to `data/costs.json`.

View statistics:
```bash
npm run costs:report
```

Or visit `/dashboard/costs` in the frontend.

## 🐛 Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Set `ANTHROPIC_API_KEY` in `.env` to enable Vision Refinement and A/B Testing
- These features are optional and will skip gracefully if not set

### "Playwright tests fail"
- Run `npm run playwright:install` to install browsers
- Check that dev server is running on port 3002

### "Lighthouse audit fails"
- Ensure Chrome/Chromium is installed
- Check that dev server is accessible at `http://localhost:3002`

### "Cost tracking not working"
- Check that `data/` directory exists and is writable
- Verify feature flag `trackCosts` is enabled

## 📝 Version History

- **V8.0.0** - P0/P1/P2 features, Next.js 16, Shadcn/ui, E2E testing
- **V7.0.0** - Stable baseline
