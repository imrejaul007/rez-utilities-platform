# Admin App — Master Bug Index

> **Audit target:** `rezadmin` (React Native + Expo Router, admin console)
> **Method:** Exhaustive static source reading (11 parallel audit agents, domain-scoped)
> **Caveat:** Build/CI not green during audit; findings from source reading. Admin app is high-blast-radius — every CRITICAL here can affect every user/merchant in the platform.
> **Related:** See [UNIFIED-REMEDIATION-PLAN.md](UNIFIED-REMEDIATION-PLAN.md).

---

## Severity totals

| Severity | Count |
|----------|------:|
| CRITICAL | 25 |
| HIGH | 84 |
| MEDIUM | 153 |
| LOW | 59 |
| **Total** | **321** |

## Domain breakdown

| # | Domain | File | Prefix | CRIT | HIGH | MED | LOW | Total |
|--:|--------|------|--------|-----:|-----:|----:|----:|------:|
| 1 | Auth / RBAC | [ADMIN-APP-AUTH.md](ADMIN-APP-AUTH.md) | AA-AUT | 3 | 7 | 8 | 6 | 24 |
| 2 | Dashboards | [ADMIN-APP-DASHBOARDS.md](ADMIN-APP-DASHBOARDS.md) | AA-DSH | 2 | 9 | 10 | 6 | 27 |
| 3 | User management | [ADMIN-APP-USERS.md](ADMIN-APP-USERS.md) | AA-USR | 2 | 6 | 11 | 6 | 25 |
| 4 | Merchant management | [ADMIN-APP-MERCHANT-MGMT.md](ADMIN-APP-MERCHANT-MGMT.md) | AA-MER | 1 | 12 | 20 | 2 | 35 |
| 5 | Order operations | [ADMIN-APP-ORDERS.md](ADMIN-APP-ORDERS.md) | AA-ORD | 4 | 4 | 8 | 4 | 20 |
| 6 | Finance operations | [ADMIN-APP-FINANCE.md](ADMIN-APP-FINANCE.md) | AA-FIN | 5 | 10 | 13 | 0 | 28 |
| 7 | Campaigns / Marketing | [ADMIN-APP-CAMPAIGNS.md](ADMIN-APP-CAMPAIGNS.md) | AA-CMP | 5 | 10 | 18 | 7 | 40 |
| 8 | Analytics / Reports | [ADMIN-APP-ANALYTICS.md](ADMIN-APP-ANALYTICS.md) | AA-ANL | 3 | 12 | 23 | 12 | 50 |
| 9 | Infra / State | [ADMIN-APP-INFRA.md](ADMIN-APP-INFRA.md) | AA-INF | 0 | 4 | 11 | 5 | 20 |
| 10 | API contracts | [ADMIN-APP-API-CONTRACTS.md](ADMIN-APP-API-CONTRACTS.md) | AA-API | 0 | 3 | 12 | 7 | 22 |
| 11 | Security | [ADMIN-APP-SECURITY.md](ADMIN-APP-SECURITY.md) | AA-SEC | 0 | 7 | 19 | 4 | 30 |

## Bug-ID prefix map

| Prefix | Domain |
|--------|--------|
| AA-AUT | Admin auth / sessions / 2FA |
| AA-DSH | Dashboards / KPIs |
| AA-USR | User management / support |
| AA-MER | Merchant management / approvals |
| AA-ORD | Order operations / refunds |
| AA-FIN | Finance / payouts / reconciliation |
| AA-CMP | Campaigns / coupons / notifications |
| AA-ANL | Analytics / reports / exports |
| AA-INF | Contexts / hooks / utilities |
| AA-API | API client / type drift |
| AA-SEC | RBAC enforcement / audit trails |

## Admin-specific risks (elevated attention required)

These categories carry unique admin-app risk and are addressed as first-class concerns in the unified plan:

1. **Privilege escalation** — every admin screen must be double-gated (route + API).
2. **Audit trail completeness** — every money movement and every user/merchant state change needs who/when/why/IP.
3. **Destructive action confirmation** — bulk deletes, bulk suspensions, payout approvals require typed confirmation + optional two-person approval for threshold amounts.
4. **PII egress via exports** — CSV/XLSX exports must be scoped by role and watermarked.
5. **Session hygiene** — short TTL, forced re-auth for sensitive actions, device binding.
