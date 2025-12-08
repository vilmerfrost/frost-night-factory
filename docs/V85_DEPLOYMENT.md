# V8.5 Production Deployment Guide

## 📋 Pre-Deployment Checklist (Week 1)

### Database Setup

- [ ] **Run migration in Supabase staging**
  ```sql
  -- Copy and run: supabase/migrations/20251206_state_machine.sql
  ```

- [ ] **Verify indexes created**
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('pipelines', 'error_state', 'dead_letter_queue');
  -- Should see: idx_pipelines_state, idx_pipelines_heartbeat, etc.
  ```

- [ ] **Set up zombie reaper cron** (if pg_cron available)
  ```sql
  SELECT cron.schedule(
    'zombie-reaper',
    '* * * * *',
    $$ SELECT reset_zombie_pipelines(); $$
  );
  ```

- [ ] **Test zombie reaper manually**
  ```sql
  SELECT reset_zombie_pipelines();
  -- Should return count of reset pipelines
  ```

- [ ] **Create code_snapshots table** (if not exists)
  ```sql
  CREATE TABLE IF NOT EXISTS code_snapshots (
    id TEXT PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id),
    phase TEXT NOT NULL,
    files JSONB NOT NULL,
    status TEXT DEFAULT 'valid',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX idx_snapshots_pipeline ON code_snapshots(pipeline_id, created_at DESC);
  ```

### Code Setup

- [ ] **Install dependencies**
  ```bash
  npm install prom-client vitest @vitest/coverage-v8
  ```

- [ ] **Run syntax validator**
  ```bash
  npm run validate-syntax
  # Fix any critical errors before deployment
  ```

- [ ] **Run full test suite**
  ```bash
  npm run test
  # All tests must pass
  ```

- [ ] **Run test coverage**
  ```bash
  npm run test:coverage
  # Aim for >80% coverage
  ```

- [ ] **Build project**
  ```bash
  npm run build
  # Verify no build errors
  ```

- [ ] **Check ESLint**
  ```bash
  npm run lint
  # Fix critical warnings
  ```

### Environment Variables

- [ ] **Set Supabase credentials**
  ```bash
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```

- [ ] **Set feature flags**
  ```bash
  V85_QUARANTINE_ENABLED=true
  V85_METAMORPHIC_ENABLED=true
  V85_METRICS_ENABLED=true
  ```

### Monitoring Setup

- [ ] **Set up Prometheus scraping**
  - Configure Prometheus to scrape `/metrics` endpoint
  - Set scrape interval: `30s`
  - Add labels: `environment=production`, `version=v8.5`

- [ ] **Create Grafana dashboard**
  - Import dashboard config (if available)
  - Or create from scratch using these metrics:
    - `quarantine_artifacts_received_total`
    - `quarantine_artifacts_rejected_total`
    - `pipeline_phase_transitions_total`
    - `error_loop_detections_total`
    - `pipeline_active_workers`

- [ ] **Configure alerts**
  ```yaml
  # prometheus-alerts.yml
  - alert: HighQuarantineRejectionRate
    expr: rate(quarantine_artifacts_rejected_total[5m]) / rate(quarantine_artifacts_received_total[5m]) > 0.3
    for: 5m
    annotations:
      summary: "Quarantine rejection rate > 30%"
  
  - alert: ErrorLoopDetected
    expr: increase(error_loop_detections_total[1h]) > 5
    annotations:
      summary: "Multiple error loops detected"
  
  - alert: NoActiveWorkers
    expr: pipeline_active_workers == 0
    for: 5m
    annotations:
      summary: "No active pipeline workers"
  ```

### Validation Tests

- [ ] **Run smoke tests**
  ```bash
  # Create 5 test pipelines
  # Verify quarantine blocks bad code
  # Verify state machine tracks phases
  # Verify metrics appear in Prometheus
  ```

- [ ] **Verify quarantine blocks bad code**
  ```typescript
  const badCode = 'interface X = string;'; // Invalid
  const qId = await quarantine.receive(badCode);
  const validation = await quarantine.validate(qId, 'test.ts');
  expect(validation.passed).toBe(false);
  ```

- [ ] **Verify zombie reaper runs**
  ```sql
  -- Manually set stale heartbeat
  UPDATE pipelines 
  SET last_heartbeat = NOW() - INTERVAL '3 minutes'
  WHERE id = 'test-pipeline-id';
  
  -- Run reaper
  SELECT reset_zombie_pipelines();
  -- Should reset the pipeline
  ```

- [ ] **Verify metrics endpoint**
  ```bash
  curl http://localhost:3000/metrics
  # Should return Prometheus metrics
  ```

---

## 🚀 Deployment (Week 1, Day 7)

### Pre-Deployment

- [ ] **Choose deployment window**
  - Low-traffic period
  - Team available for monitoring
  - Rollback plan ready

- [ ] **Backup current state**
  ```bash
  # Backup database
  pg_dump your_database > backup_pre_v85.sql
  
  # Backup code
  git tag v8.0-pre-v85
  ```

- [ ] **Deploy code**
  ```bash
  git checkout v8.5
  npm install
  npm run build
  npm run test
  ```

### Deployment Steps

1. **Deploy to production**
   ```bash
   # Your deployment command here
   npm run deploy:production
   ```

2. **Enable feature flags**
   ```bash
   export V85_QUARANTINE_ENABLED=true
   export V85_METAMORPHIC_ENABLED=true
   export V85_METRICS_ENABLED=true
   ```

3. **Restart services**
   ```bash
   # Restart pipeline runner
   pm2 restart pipeline-runner
   
   # Or systemd
   systemctl restart pipeline-runner
   ```

4. **Verify deployment**
   ```bash
   # Check logs
   tail -f /var/log/pipeline-runner.log
   
   # Check metrics
   curl http://localhost:3000/metrics | grep quarantine
   ```

### Post-Deployment Monitoring (First Hour)

- [ ] **Monitor error rates**
  - Check Prometheus: `rate(pipeline_errors_total[5m])`
  - Should be stable or decreasing

- [ ] **Monitor quarantine rejection rate**
  - Check: `rate(quarantine_artifacts_rejected_total[5m]) / rate(quarantine_artifacts_received_total[5m])`
  - Should be < 30%

- [ ] **Run 10 production pipelines**
  - Monitor each through all phases
  - Verify no zombie pipelines
  - Verify snapshots are created

- [ ] **Check for error loops**
  - Query: `SELECT * FROM error_state WHERE total_attempts >= 3`
  - Should be empty or minimal

---

## 📊 Post-Deployment (Week 2)

### Daily Monitoring

- [ ] **Review metrics dashboard**
  - Quarantine rejection rate
  - Pipeline success rate
  - Error loop detections
  - Active workers count

- [ ] **Check dead letter queue**
  ```sql
  SELECT COUNT(*), error_type 
  FROM dead_letter_queue 
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY error_type;
  ```

- [ ] **Review error patterns**
  ```sql
  SELECT error_type, COUNT(*) as count
  FROM error_state
  WHERE last_seen_at > NOW() - INTERVAL '7 days'
  GROUP BY error_type
  ORDER BY count DESC;
  ```

### Tuning (Week 2)

- [ ] **Adjust quarantine thresholds**
  - Based on rejection rate
  - Based on false positives

- [ ] **Tune metamorphic validation**
  - Adjust consistency threshold
  - Adjust variation count

- [ ] **Optimize snapshot frequency**
  - Based on storage usage
  - Based on rollback needs

### Documentation

- [ ] **Document learnings**
  - Create `docs/v85-learnings.md`
  - Record issues encountered
  - Record solutions applied

- [ ] **Update runbooks**
  - Add V8.5 troubleshooting steps
  - Add rollback procedures
  - Add monitoring queries

---

## 🔄 Rollback Plan

### If Errors Spike > 50%

1. **Disable V8.5 features**
   ```bash
   export V85_QUARANTINE_ENABLED=false
   export V85_METAMORPHIC_ENABLED=false
   ```

2. **Revert to V8.0 codebase**
   ```bash
   git checkout v8.0
   npm install
   npm run build
   npm run deploy:production
   ```

3. **Restore database** (if needed)
   ```bash
   psql your_database < backup_pre_v85.sql
   ```

4. **Analyze failure**
   ```sql
   -- Check dead letter queue
   SELECT * FROM dead_letter_queue 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   
   -- Check error state
   SELECT * FROM error_state
   WHERE last_seen_at > NOW() - INTERVAL '1 hour';
   ```

5. **Fix issues in staging**
   - Reproduce errors
   - Fix root causes
   - Re-test thoroughly

6. **Re-attempt deployment**
   - After fixes verified
   - With additional monitoring
   - During low-traffic window

---

## ✅ Success Criteria

Deployment is successful if:

- ✅ Quarantine rejection rate < 30%
- ✅ Pipeline success rate > 90%
- ✅ Error loop detections < 5/day
- ✅ No zombie pipelines
- ✅ Metrics collection working
- ✅ Rollback tested and ready

---

## 📞 Support Contacts

- **On-Call Engineer**: [Contact Info]
- **Database Admin**: [Contact Info]
- **DevOps**: [Contact Info]

---

## 📚 Additional Resources

- [V8.5 Architecture Overview](./V85_ARCHITECTURE.md)
- [Rollback Procedures](./V85_ROLLBACK.md)
- [Monitoring Guide](./V85_MONITORING.md)
- [Troubleshooting](./V85_TROUBLESHOOTING.md)

