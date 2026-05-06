# CRITICAL-012: Firebase Admin SDK JSON on Disk — Secret Exposure Risk

## Severity: P1 — Security / Secret Management

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

Firebase Admin SDK credentials (private key JSON) are stored as files on disk. These files contain sensitive credentials that should be stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) instead.

---

## Affected Services

| Service | File Location |
|---------|-------------|
| `rez-backend` (monolith) | `src/config/firebase.json` or similar |
| `rez-notification-service` | `src/config/firebase-service-account.json` |

---

## Code Reference

**File:** `rez-backend/.../src/config/firebase.ts`

```typescript
import admin from 'firebase-admin';

// Service account JSON file on disk — risk of exposure
admin.initializeApp({
  credential: admin.credential.cert(
    require('./firebase-service-account.json')  // ← Secrets on disk
  )
});
```

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "rez-app-xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...",
  "client_email": "firebase-adminsdk-xxx@rez-app-xxx.iam.gserviceaccount.com"
}
```

---

## Impact

- **Private key exposure** — if the repo is ever made public (or a fork is created), credentials are leaked
- **Git history risk** — even if deleted, the key exists in git history
- **No rotation** — file-based keys are hard to rotate without redeployment
- **Compliance** — PCI-DSS, SOC2, and other frameworks require secrets in vaults
- **Shared credential risk** — same key used across environments

---

## Root Cause

Firebase Admin SDK's `cert()` method accepts a file path, making it easy to use `require('./file.json')`. This convenience pattern leads to secrets-on-disk anti-patterns.

---

## Fix Required

1. **Store credentials in environment variables** (minimum viable fix):
   ```typescript
   admin.initializeApp({
     credential: admin.credential.cert({
       projectId: process.env.FIREBASE_PROJECT_ID,
       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
       // UseGOogler=false for self-signed
       privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
     })
   });
   ```

2. **Use AWS Secrets Manager** (production):
   ```typescript
   import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

   async function getFirebaseCredentials() {
     const client = new SecretsManagerClient({ region: 'ap-south-1' });
     const command = new GetSecretValueCommand({
       SecretId: 'prod/rez/firebase-admin'
     });
     const response = await client.send(command);
     return JSON.parse(response.SecretString);
   }

   const creds = await getFirebaseCredentials();
   admin.initializeApp({
     credential: admin.credential.cert(creds)
   });
   ```

3. **Remove existing JSON files from git history:**
   ```bash
   # Use BFG Repo-Cleaner to remove from git history
   java -jar bfg.jar --delete-files firebase-service-account.json
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```

4. **Add pre-commit hook** to prevent re-addition:
   ```bash
   # .git/hooks/pre-commit
   if git diff --cached --name-only | grep -q 'firebase.*\.json$'; then
     echo "ERROR: Firebase JSON files must not be committed"
     exit 1
   fi
   ```

---

## Related Gaps

- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same pattern of env var misuse
- [CRITICAL-002-catalog-auth-broken](CRITICAL-002-catalog-auth-broken.md) — Same pattern of missing proper config
