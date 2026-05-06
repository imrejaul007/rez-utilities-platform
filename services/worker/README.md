# REZ Worker Service

Background job processing service for the REZ Utilities Platform.

## Overview

The worker service handles background job processing using BullMQ with Redis.

## Setup

```bash
npm install
npm run build
npm start
```

## Configuration

Environment variables:
- `REDIS_URL` - Redis connection URL
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment (development/production)
