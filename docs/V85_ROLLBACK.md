# V8.5 Rollback Procedures

## 🚨 Emergency Rollback

### Quick Rollback (< 5 minutes)

```bash
# 1. Disable V8.5 features
export V85_QUARANTINE_ENABLED=false
export V85_METAMORPHIC_ENABLED=false

# 2. Restart services
pm2 restart pipeline-runner
# OR
systemctl restart pipeline-runner

# 3. Verify rollback
curl http://localhost:3000/health
```

### Full Rollback (< 15 minutes)

```bash
# 1. Stop services
pm2 stop pipeline-runner

# 2. Revert code
git checkout v8.0
npm install
npm run build

# 3. Restore database (if needed)
psql your_database < backup_pre_v85.sql

# 4. Restart services
pm2 start pipeline-runner

# 5. Verify
npm run test
curl http://localhost:3000/health
```

---

## 🔍 Rollback Triggers

Rollback if any of these occur:

- ❌ Error rate increases > 50%
- ❌ Quarantine rejection rate > 50%
- ❌ Multiple error loops detected (> 10/hour)
- ❌ All pipelines stuck in "running" state
- ❌ Database connection failures
- ❌ Critical security issues detected

---

## 📊 Post-Rollback Analysis

After rollback, analyze:

1. **Dead Letter Queue**
   ```sql
   SELECT * FROM dead_letter_queue 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

2. **Error State**
   ```sql
   SELECT * FROM error_state
   WHERE last_seen_at > NOW() - INTERVAL '1 hour'
   ORDER BY total_attempts DESC;
   ```

3. **Pipeline State**
   ```sql
   SELECT phase, phase_status, COUNT(*) 
   FROM pipelines
   WHERE updated_at > NOW() - INTERVAL '1 hour'
   GROUP BY phase, phase_status;
   ```

4. **Metrics**
   ```bash
   # Export metrics from Prometheus
   curl http://localhost:9090/api/v1/query?query=quarantine_artifacts_rejected_total
   ```

---

## 🔧 Fixing Issues

After identifying root causes:

1. **Create fix branch**
   ```bash
   git checkout -b fix/v85-issue-description
   ```

2. **Implement fixes**
   - Fix code issues
   - Update tests
   - Update documentation

3. **Test thoroughly**
   ```bash
   npm run test
   npm run test:coverage
   npm run validate-syntax
   ```

4. **Deploy fix**
   ```bash
   git push origin fix/v85-issue-description
   # Create PR, review, merge, deploy
   ```

---

## 📝 Rollback Checklist

- [ ] Disabled V8.5 feature flags
- [ ] Reverted code to V8.0
- [ ] Restored database (if needed)
- [ ] Restarted services
- [ ] Verified services running
- [ ] Analyzed failure root causes
- [ ] Documented issues
- [ ] Created fix tickets
- [ ] Notified team

