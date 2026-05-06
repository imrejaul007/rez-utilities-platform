# HIGH-014: Search Service Paths Not Routed Through NGINX Gateway

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

Native search service paths (`/search/stores`, `/home/feed`, `/recommend/*`, `/search/history`) are NOT routed through the NGINX API gateway. These endpoints are only accessible if clients know the internal search service URL directly.

---

## Code Reference

**File:** `rez-api-gateway/nginx.conf`

```nginx
# Only these are routed:
location /api/stores { proxy_pass ... }
location /api/products { proxy_pass ... }
location /api/menu { proxy_pass ... }

# MISSING:
location /search/stores { }       # NOT routed
location /home/feed { }           # NOT routed
location /recommend/ { }         # NOT routed
location /search/history { }      # NOT routed
```

---

## Impact

- Search endpoints inaccessible from public gateway
- Clients need direct search service URL (infrastructure leak)
- No centralized routing, logging, or rate limiting for search
- Gateway becomes incomplete as new features are added

---

## Fix Required

Add search routes to NGINX gateway:
```nginx
location /search/stores {
  proxy_pass http://rez-search-service.internal;
}
location /home/feed {
  proxy_pass http://rez-search-service.internal;
}
location ~ ^/recommend/ {
  proxy_pass http://rez-search-service.internal;
}
```

---

## Related

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md)
