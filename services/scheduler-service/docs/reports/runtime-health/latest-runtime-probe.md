# Runtime Health Probe Report

- Generated (UTC): `2026-04-09T06:41:30Z`
- Runner: `scripts/runtime-health-probe.sh`

## Probes

### rez-backend health (Render URL)
- URL: `https://rez-backend-8dfu.onrender.com/health`
- HTTP: `200`
- Body:
```json
{"status":"ok","db":"connected","redis":"connected","payments":{"razorpay":"error"},"uptime":595,"version":"1.0.0","timestamp":"2026-04-09T06:41:31.092Z"}
```

### rez-finance live
- URL: `https://rez-finance-service.onrender.com/health/live`
- HTTP: `404`
- Body:
```json
Not Found

```

### rez-finance ready
- URL: `https://rez-finance-service.onrender.com/health/ready`
- HTTP: `404`
- Body:
```json
Not Found

```

### rez-finance health
- URL: `https://rez-finance-service.onrender.com/health`
- HTTP: `404`
- Body:
```json
Not Found

```

