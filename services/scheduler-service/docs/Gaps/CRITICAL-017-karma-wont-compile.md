# CRITICAL-017: Karma Service Won't Compile — Duplicate Variable Declaration

## Severity: P1 — Build / TypeScript Compilation

## Date Discovered: 2026-04-16
## Phase: Phase 2 — Data Model & Schema Validation

---

## Issue Summary

The karma service has a duplicate `const startOfWeek` declaration at lines 128 and 195 of `karmaService.ts`. TypeScript compilation fails with a `Duplicate identifier` error. The service cannot be deployed.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-karma-service` | Cannot compile, cannot deploy |

---

## Code Reference

**File:** `rez-karma-service/src/services/karmaService.ts:128,195`

```typescript
// Line ~128 — first declaration
const startOfWeek = new Date();
startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
startOfWeek.setHours(0, 0, 0, 0);

// ... ~67 lines of code ...

// Line ~195 — DUPLICATE declaration
const startOfWeek = new Date();  // ← ERROR: Duplicate identifier 'startOfWeek'
startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
startOfWeek.setHours(0, 0, 0, 0);
```

---

## Impact

- **Service cannot compile** — `npm run build` fails
- **Service cannot deploy** — build pipeline fails
- **TypeScript strict mode** catches this but it may have been introduced in a non-strict build
- **Stops all karma service deployments** until fixed

---

## Root Cause

The `startOfWeek` variable was declared twice in the same scope. Likely introduced during a copy-paste refactor or merge conflict resolution.

---

## Fix Required

1. **Remove the duplicate declaration** — determine which usage is correct and remove the other:
   ```typescript
   // If first usage is needed:
   const startOfWeek = new Date();
   startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
   startOfWeek.setHours(0, 0, 0, 0);
   // Use here...

   // Remove the second declaration (lines ~195-197)
   // If second usage is needed, reuse the variable instead of re-declaring

   // If second usage needs different calculation, rename:
   const startOfCurrentWeek = new Date();
   startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - startOfCurrentWeek.getDay());
   startOfCurrentWeek.setHours(0, 0, 0, 0);
   ```

2. **Enable strict TypeScript compilation in CI:**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true
     }
   }
   ```

3. **Add pre-commit build check:**
   ```bash
   # .git/hooks/pre-commit
   npm run build || { echo "Build failed"; exit 1; }
   ```

---

## Related Gaps

- [CRITICAL-005-karma-2x-inflation](CRITICAL-005-karma-2x-inflation.md) — Same service, different bug
- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Same service, auth failure
