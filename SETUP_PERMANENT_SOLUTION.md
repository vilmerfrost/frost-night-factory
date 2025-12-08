# 🔒 Setup Guide - Permanent Solution (4-Part System)

## 📋 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install --save-dev husky chokidar
```

### Step 2: Setup Husky (Pre-Commit Hook)

```bash
# Initialize Husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "bash .husky/pre-commit"

# Make executable (Linux/Mac)
chmod +x .husky/pre-commit

# Windows: Hook should work as-is (Git Bash)
```

### Step 3: Test Pre-Commit Hook

```bash
# Make a syntax error
echo "const x = {" >> agent-runner/test-file.ts

# Try to commit
git add agent-runner/test-file.ts
git commit -m "test"

# Should be blocked! ✅
```

### Step 4: Start Health Watcher (Optional)

```bash
# Install PM2 globally (recommended)
npm install -g pm2

# Start health watcher
pm2 start tsx --name health-watcher -- scripts/watch-health.ts

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup
```

### Step 5: Start Auto Backup (Optional)

```bash
# Start with PM2
pm2 start tsx --name auto-backup -- scripts/auto-backup.ts

# Or schedule with Windows Task Scheduler (PowerShell)
$action = New-ScheduledTaskAction -Execute "tsx" -Argument "C:\Users\vilme\frost-night-factory\scripts\auto-backup.ts"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "FrostAutoBackup" -Action $action -Trigger $trigger
```

### Step 6: Configure AI Review (Optional)

```bash
# Set API key
export ANTHROPIC_API_KEY=your-api-key

# Or add to .env file
echo "ANTHROPIC_API_KEY=your-api-key" >> .env
```

---

## ✅ Verification

### Test Pre-Commit Hook

```bash
# Create a test file with syntax error
echo "const x = {" > agent-runner/test-syntax.ts
git add agent-runner/test-syntax.ts
git commit -m "test"

# Should see:
# ❌ COMMIT BLOCKED: Syntax errors detected
```

### Test Health Watcher

```bash
# Edit a file
echo "const broken = {" >> agent-runner/test-file.ts

# Watch PM2 logs
pm2 logs health-watcher

# Should see validation messages
```

### Test Auto Backup

```bash
# Check backup directory
ls .backups/

# Should see backups like:
# frost-backup-2025-01-06T12-00-00-000Z
```

### Test AI Review

```bash
# Stage some changes
git add agent-runner/pipeline-runner.ts

# Run AI review
tsx scripts/ai-code-review.ts --pre-commit

# Should see review results
```

---

## 🎯 What Each Part Does

### Part 1: Pre-Commit Hook
- **When:** Every `git commit`
- **What:** Validates syntax, TypeScript, file sizes, patterns
- **Result:** Blocks commits with errors

### Part 2: Health Watcher
- **When:** Continuously (watches file changes)
- **What:** Validates files as they're edited
- **Result:** Real-time error detection

### Part 3: Auto Backup
- **When:** Every hour (configurable)
- **What:** Creates backups of codebase
- **Result:** Never lose more than 1 hour of work

### Part 4: AI Code Review
- **When:** Pre-commit (if API key set)
- **What:** AI reviews code for logical errors
- **Result:** Catches errors syntax checkers miss

---

## 📊 Status Check

```bash
# Check PM2 processes
pm2 status

# Should see:
# health-watcher  online
# auto-backup    online

# Check Husky
ls .husky/

# Should see:
# pre-commit

# Check backups
ls .backups/ | wc -l

# Should see backup count
```

---

## 🆘 Troubleshooting

### Pre-Commit Hook Not Running

```bash
# Reinstall
npx husky install
npx husky add .husky/pre-commit "bash .husky/pre-commit"
chmod +x .husky/pre-commit
```

### Health Watcher Not Working

```bash
# Check PM2
pm2 status
pm2 logs health-watcher

# Restart
pm2 restart health-watcher
```

### Backups Not Creating

```bash
# Check directory
ls .backups/

# Test manually
tsx scripts/auto-backup.ts

# Check permissions
```

---

## ✅ Success!

Once all 4 parts are running:

- ✅ **Can't commit broken code** (pre-commit hook)
- ✅ **Real-time error detection** (health watcher)
- ✅ **Automatic backups** (auto backup)
- ✅ **AI code review** (AI review)

**Your codebase is now protected! 🛡️**

