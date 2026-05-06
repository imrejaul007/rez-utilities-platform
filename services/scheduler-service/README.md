# REZ Scheduler Service

Cron job and scheduled task microservice using BullMQ for job orchestration.

## Purpose

The Scheduler Service manages:
- Scheduled job orchestration
- Cron job management
- Service-to-service job triggering
- Job monitoring and retry logic
- Job history and logging

## Environment Variables

```env
# Server
PORT=3012
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-scheduler

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=2

# Internal service URLs
PAYMENT_SERVICE_URL=http://localhost:3008
ORDER_SERVICE_URL=http://localhost:3005
FINANCE_SERVICE_URL=http://localhost:3010
NOTIFICATION_SERVICE_URL=http://localhost:3011
AUTH_SERVICE_URL=http://localhost:3003
CATALOG_SERVICE_URL=http://localhost:3006
MERCHANT_SERVICE_URL=http://localhost:3007

# Internal service token for service-to-service calls
INTERNAL_SERVICE_TOKEN=your-internal-service-token

# Sentry (optional)
SENTRY_DSN=

# JWT secret (for admin API auth)
JWT_SECRET=your-jwt-secret
```

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Production build
npm run build

# Start production server
npm start
```

## API Endpoints

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/jobs | List all jobs |
| GET | /api/jobs/:jobId | Get job details |
| POST | /api/jobs | Create new job |
| PUT | /api/jobs/:jobId | Update job |
| DELETE | /api/jobs/:jobId | Delete job |
| POST | /api/jobs/:jobId/execute | Execute job now |
| POST | /api/jobs/:jobId/cancel | Cancel scheduled job |

### Schedules

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/schedules | List schedules |
| POST | /api/schedules | Create schedule |
| PUT | /api/schedules/:scheduleId | Update schedule |
| DELETE | /api/schedules/:scheduleId | Delete schedule |

### Job History

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/jobs/:jobId/history | Get job execution history |
| GET | /api/history | Get recent job executions |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |

## Scheduled Jobs

| Job Name | Schedule | Description |
|----------|----------|-------------|
| payment-retry | Every 5 min | Retry failed payments |
| order-timeout | Every 1 min | Cancel unpaid orders |
| sync-catalog | Every 15 min | Sync catalog with merchants |
| generate-reports | Daily 1 AM | Generate daily reports |
| cleanup-sessions | Every hour | Clean expired sessions |
| update-leaderboards | Every 5 min | Refresh gamification leaderboards |

## BullMQ Queues

| Queue | Priority Jobs | Description |
|-------|---------------|-------------|
| scheduler | Critical jobs | High-priority scheduled tasks |
| jobs | Default jobs | Standard background jobs |
| bulk | Low priority | Batch processing jobs |

## Job Data Model

```typescript
{
  jobId: string;
  name: string;
  type: 'scheduled' | 'delayed' | 'repeatable';
  data: object;
  schedule?: string;        // Cron expression
  nextRun?: Date;
  lastRun?: Date;
  status: 'pending' | 'active' | 'completed' | 'failed';
  attempts: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Retry Configuration

| Failure Type | Retry Policy |
|--------------|--------------|
| Network timeout | 3 retries, exponential backoff |
| Service unavailable | 5 retries, 1 min delay |
| Validation error | No retry, fail immediately |
| Rate limited | 10 retries, 5 min delay |

## Architecture

```
┌─────────────┐
│  Scheduler  │
│   Service   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   BullMQ    │────▶│  Payment    │
│   (Redis)   │     │  Service    │
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Worker    │────▶│   Order     │
│   Pool      │     │  Service    │
└─────────────┘     └─────────────┘
```

## Deployment

### Render.com
1. Connect GitHub repository
2. Build command: `npm run build`
3. Start command: `npm start`
4. Configure Redis URL

### Docker
```bash
docker build -t rez-scheduler-service .
docker run -p 3012:3012 --env-file .env rez-scheduler-service
```

## Related Services

- **rez-payment-service** - Payment retry jobs
- **rez-order-service** - Order timeout jobs
- **rez-auth-service** - Session cleanup

## License

MIT
