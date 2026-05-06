# HIGH-015: 40+ Models Use Schema.Types.Mixed — No Validation

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

Over 40 Mongoose models use `Schema.Types.Mixed` for dynamic fields, disabling Mongoose's schema validation. Data integrity relies entirely on application-layer validation which may not be consistent.

---

## Code Reference

```typescript
// Throughout the codebase:
metadata: { type: Schema.Types.Mixed },
eventData: { type: Schema.Types.Mixed },
context: { type: Schema.Types.Mixed },
// 40+ instances across all models
```

---

## Impact

- Invalid data can be written to the database
- Schema evolution is impossible — no migration path for Mixed fields
- TypeScript types can't enforce structure on Mixed fields
- Analytics and reporting become unreliable

---

## Fix Required

1. Audit all Mixed fields:
   ```bash
   grep -rn "Schema.Types.Mixed" --include="*.ts" .
   ```

2. Replace with typed subdocuments:
   ```typescript
   // Before:
   metadata: { type: Schema.Types.Mixed }

   // After:
   metadata: {
     userAgent: String,
     ip: String,
     extra: Schema.Types.Mixed  // Only for truly dynamic data
   }
   ```

3. Use `strict: false` only for documented extension points

---

## Related

- [CRITICAL-007-fraudflag-missing](CRITICAL-007-fraudflag-missing.md)
- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md)
