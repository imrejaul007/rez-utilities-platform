# CRON-010: Seeding Errors Silently Swallowed — Service Starts in Broken State

**Severity:** HIGH
**Category:** Error Handling / Initialization
**Gap ID:** CRON-010
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 30 minutes
**Related:** NA2-HIGH-04 (silent error swallowing)

---

## Description

If `seedWalletFeatureFlags()` or `runHabitFocusFlags()` fails during startup, the service starts in a partially-initialized state with only a `logger.warn`. Feature flags that should exist don't, causing downstream auth/authorization failures that are very hard to debug.

### Affected File

`src/config/cronJobs.ts:506-508`

```typescript
} catch (seedErr) {
  // Never crash the server if seeding fails
  logger.warn('[SeedDemo] Demo data seed failed (non-fatal):', seedErr);
}
```

### Impact

- Service starts but feature flags are missing or incomplete
- Auth middleware checks for flags that don't exist — wrong behavior
- Very hard to debug: service starts fine, logs show only a warn, but downstream auth fails
- Different pods may have different feature flag states depending on which seed runs first

### Fix Direction

```typescript
} catch (seedErr) {
  logger.error('[SeedDemo] Demo data seed failed — feature flags may be missing', {
    error: (seedErr as Error).message,
    stack: (seedErr as Error).stack,
  });

  // Option A: Fail fast in production
  if (process.env.NODE_ENV === 'production') {
    throw seedErr; // Don't start in broken state
  }

  // Option B: Continue with degraded functionality + alert
  await sendStartupAlert({
    type: 'SEEDING_FAILURE',
    error: (seedErr as Error).message,
    service: process.env.SERVICE_NAME || 'rez-backend',
  });
}
```

### References
- NA2-HIGH-04: 9 silent `.catch(() => {})` in app/hook layer
- CRITICAL-015: Finance service silent coin failure
