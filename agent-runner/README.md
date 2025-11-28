# ❄️ Frost Agent Runner

Agent runner som kör på din lokala dator och pollar Supabase för nya tasks.

## Setup

1. Installera dependencies:
```bash
npm install
```

2. Skapa `.env` fil:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REPO_LOCAL_PATH=/path/to/your/repo
```

3. Kör agent runner:
```bash
npm run dev  # Development mode med watch
# eller
npm start    # Production mode
```

## V1 Features

- ✅ Pollar Supabase för pending tasks
- ✅ Kör `git pull` på repo
- ✅ Checkout rätt branch
- ✅ Kör `npm test`
- ✅ Uppdaterar task status och logs

## V2 TODO

- [ ] Integrera LLM för att analysera buggar
- [ ] Generera patches/diffs
- [ ] Skriva filer automatiskt
- [ ] Git commit & push
- [ ] Mer avancerad testning

## Användning

1. Skapa en task via web UI eller API:
```bash
curl -X POST http://localhost:3000/api/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix payroll export crash",
    "description": "Steps to reproduce: ...",
    "repoUrl": "git@github.com:vilmerfrost/frost-night-factory.git",
    "branch": "main"
  }'
```

2. Agent runner plockar upp tasken automatiskt och kör den.

