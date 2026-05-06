# CRON-009: Integration Reconciliation Task Not Registered for Graceful Shutdown

**Severity:** HIGH
**Category:** Concurrency / Lifecycle
**Gap ID:** CRON-009
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 30 minutes
**Related:** CRON-001, MED-008 (no graceful shutdown in gamification)

---

## Description

`getIntegrationReconciliationTask()` is called and its result is pushed to `activeCronJobs`. But if the function returns `null` (e.g., the task already started and returned null), the task is never added to `activeCronJobs`. During `shutdownCronJobs()`, this task is not stopped — it survives SIGTERM and keeps the Node process alive indefinitely.

### Affected File

`src/config/cronJobs.ts:459-461`

```typescript
initializeIntegrationReconciliationJob();
const integrationReconciliationTask = getIntegrationReconciliationTask();
if (integrationReconciliationTask) {
  activeCronJobs.push(integrationReconciliationTask);
}
// ...
// During shutdown:
for (const job of activeCronJobs) {
  job.stop(); // integrationReconciliationTask never stopped if null
}
```

### Impact

- On SIGTERM, the Node process does not exit cleanly
- Kubernetes sends SIGKILL after graceful shutdown timeout
- In-flight requests are killed mid-execution
- Kubernetes liveness/readiness probes may fail on next startup

### Fix Direction

```typescript
const integrationReconciliationTask = getIntegrationReconciliationTask();
// Always track the task, even if it's null (for logging)
if (!integrationReconciliationTask) {
  logger.warn('[CronJobs] Integration reconciliation task returned null — already running?');
}
// Always attempt to stop (null is safe with optional chaining)
activeCronJobs.push(integrationReconciliationTask);

// OR: Make getIntegrationReconciliationTask() always return a valid task object
// OR: Track by task name string, not by reference
const namedJobs = ['decay-job', 'integration-reconciliation', 'coin-expiry'];
```
