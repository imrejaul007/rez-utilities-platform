# rez-media-events

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose**: Handles all media asset lifecycle operations for the REZ platform. It provides two capabilities:
1. An HTTP upload server for multipart image uploads (from the merchant or consumer apps)
2. An async BullMQ worker that processes uploaded images — resizing to multiple variants via `sharp`, uploading to Cloudinary, updating MongoDB entity documents, and emitting completion events to `rez-notification-events`

**Architecture position**: Receives media jobs from any REZ service that publishes to the `media-events` BullMQ queue (primarily rez-backend and rez-merchant). After processing, it writes variant URLs back into MongoDB `products`, `stores`, or `users` collections (shared with the main MongoDB instance) and publishes `image.processed` events to the `notification-events` queue.

**Tech stack**:
- Runtime: Node.js 20.x, TypeScript
- Framework: Express 4 (HTTP server only)
- Queue: BullMQ 5 on Redis (IORedis)
- Image processing: `sharp` 0.33
- Cloud storage: Cloudinary v1
- Database: MongoDB via Mongoose 8 (raw collections, no schema models)
- File handling: `multer` 1.4 (disk storage, local `uploads/` directory)
- Default HTTP port: **3006**
- Health server port: **3007** (PORT + 1)

---

## 2. API Routes

The HTTP server handles uploads and serves static files. No authentication middleware is enforced at the framework level — attribution is done via the optional `X-User-ID` header.

### Upload

**POST /upload**

Upload a single image file. Uses `multipart/form-data` with field name `file`.

Constraints:
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: **10 MB**
- Files stored on local disk in `./uploads/` with a randomized filename: `{timestamp}-{random7chars}{ext}`

Headers:
- `X-User-ID: {userId}` (optional) — attributed in MongoDB `media_uploads` document
- Alternatively: `?uploadedBy={userId}` query param

Request: `multipart/form-data`, field `file`

Response (201 Created):
```json
{
  "success": true,
  "url": "/uploads/1712500000000-a3f9z1k.jpg",
  "mediaId": "661abc123def456789012345"
}
```

Error responses:
- 400 if no file provided
- 400 if wrong MIME type: `"Unsupported file type: image/gif. Allowed: jpeg, png, webp"`
- 400 if file exceeds 10 MB (Multer MulterError)
- 500 if MongoDB insert fails

### Static file serving

**GET /uploads/:filename**

Serves uploaded files directly from the local `uploads/` directory via `express.static`. No authentication.

Example: `GET /uploads/1712500000000-a3f9z1k.jpg`

### Health

**GET /health**

Responds from the main HTTP server on port 3006.

```json
{ "status": "ok", "service": "rez-media-events" }
```

**GET /health** or **GET /healthz** on the separate health server (port 3007):

```json
{ "status": "ok", "uptime": 1234.56 }
```

Returns 503 if `setHealthy(false)` has been called.

**GET /ready** on health server:

```json
{ "status": "ready" }
```

---

## 3. Background Workers and Jobs

### Media Worker

- **Queue consumed**: `media-events`
- **Queues produced**: `notification-events` (emits `image.processed` job after optimization)
- **Concurrency**: 5
- **Rate limiter**: max 50 jobs per 1000ms (Cloudinary API rate limit protection)

#### Job types handled

**`image.uploaded`** (primary pipeline)

Triggered when a new image is stored in Cloudinary. Performs the full optimization pipeline:

1. Downloads the original image from `payload.imageUrl` via HTTP (30-second timeout)
2. Resizes to requested sizes (default: `thumbnail`, `medium`, `large`)
3. Uploads each resized variant to Cloudinary with suffix appended to publicId
4. Updates MongoDB entity document with variant URLs under `images.thumbnail`, `images.medium`, `images.large`
5. Emits `image.processed` job to `notification-events` queue

Job payload:
```json
{
  "eventId": "string",
  "eventType": "image.uploaded",
  "payload": {
    "imageUrl": "https://res.cloudinary.com/.../original.jpg",
    "entityType": "product | store | user",
    "entityId": "mongoId",
    "sizes": ["thumbnail", "medium", "large"]
  },
  "createdAt": "ISO string"
}
```

Image size dimensions:
| Size | Width | Height |
|------|-------|--------|
| thumbnail | 150px | 150px |
| medium | 400px | 400px |
| large | 800px | 800px |

All variants use `cover` crop, centered, JPEG quality 85, progressive encoding.

**`generate-variants`**

Uses Cloudinary's `explicit` API to generate eager transformations for existing Cloudinary assets.

Job payload:
```json
{
  "eventType": "generate-variants",
  "payload": {
    "publicId": "cloudinary-public-id",
    "variants": [
      { "width": 400, "height": 400, "crop": "fill", "suffix": "medium" }
    ]
  }
}
```

**`delete-asset`**

Deletes an asset from Cloudinary. Throws on failure (BullMQ will retry).

Job payload:
```json
{
  "eventType": "delete-asset",
  "payload": {
    "publicId": "cloudinary-public-id",
    "resourceType": "image"
  }
}
```

**`invalidate-cdn`**

Invalidates CDN cache for specific URLs via Cloudinary's `explicit` API with `invalidate: true`.

Job payload:
```json
{
  "eventType": "invalidate-cdn",
  "payload": {
    "publicId": "cloudinary-public-id",
    "invalidateUrls": ["https://..."]
  }
}
```

**`cleanup-temp`**

Logged stub. Intended for future temp file cleanup older than a threshold.

Job payload:
```json
{
  "eventType": "cleanup-temp",
  "payload": { "olderThan": "ISO date string" }
}
```

Unknown event types are logged at debug level and silently dropped.

---

## 4. Security Mechanisms

- **Upload attribution**: `X-User-ID` header or `uploadedBy` query param — optional, not enforced. No authentication required to upload.
- **File type validation**: Multer `fileFilter` rejects any MIME type not in `{image/jpeg, image/png, image/webp}` before the file is written to disk.
- **File size limit**: Multer enforces 10 MB max at the stream level.
- **No directory traversal**: Multer `diskStorage` generates randomized filenames using `Date.now()` + 7-char random alphanumeric. No user-supplied filename is used on disk.
- **Cloudinary credentials**: Loaded from environment variables at first use (`getCloudinary()` lazy init). Not hardcoded.
- **Health server isolation**: Health endpoints run on a separate port (3007) from upload endpoints (3006), ensuring health checks are never blocked by upload processing.

---

## 5. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (shared with main REZ database) |
| `REDIS_URL` | Redis connection URL for BullMQ |

### Required for image processing

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3006` | HTTP upload server port |
| `NODE_ENV` | `production` | Logging level and behavior |

Health server always runs on `PORT + 1` (default 3007).

---

## 6. Data Models

### media_uploads (raw MongoDB collection)

No Mongoose schema — accessed via `mongoose.connection.collection('media_uploads')`.

| Field | Type | Description |
|-------|------|-------------|
| `filename` | String | Randomized filename on disk |
| `originalName` | String | Original filename from the upload |
| `mimeType` | String | `image/jpeg`, `image/png`, or `image/webp` |
| `size` | Number | File size in bytes |
| `path` | String | Absolute path on disk |
| `uploadedBy` | String / null | User ID from `X-User-ID` header or query param |
| `createdAt` | Date | Upload timestamp |

### Entity documents updated by the worker

The worker updates existing documents in these collections, writing to the `images` sub-document:

| Collection | Triggered by |
|------------|-------------|
| `products` | `entityType: "product"` in `image.uploaded` job |
| `stores` | `entityType: "store"` |
| `users` | `entityType: "user"` |

The update sets `images.thumbnail`, `images.medium`, and/or `images.large` to Cloudinary URLs.

---

## 7. Local Development and Testing

### Prerequisites

- Node.js 20.x
- MongoDB
- Redis
- Cloudinary account (for image processing) or skip processing via event type avoidance

### Setup

```bash
cd rez-media-events
cp .env.example .env    # fill in MONGODB_URI, REDIS_URL, CLOUDINARY_*

npm install
npm run dev             # ts-node on port 3006
```

Minimum `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

### Testing an upload

```bash
curl -X POST http://localhost:3006/upload \
  -H "X-User-ID: user123" \
  -F "file=@/path/to/image.jpg"
```

Expected response:
```json
{
  "success": true,
  "url": "/uploads/1712500000000-abc1234.jpg",
  "mediaId": "..."
}
```

Access file: `curl http://localhost:3006/uploads/1712500000000-abc1234.jpg`

### Testing the worker

Publish a test job to the `media-events` queue using the BullMQ CLI or a script:

```javascript
const { Queue } = require('bullmq');
const q = new Queue('media-events', { connection: { host: 'localhost', port: 6379 } });
await q.add('test', {
  eventId: 'test-001',
  eventType: 'image.uploaded',
  payload: {
    imageUrl: 'https://res.cloudinary.com/your-cloud/image/upload/v1/sample.jpg',
    entityType: 'product',
    entityId: '64abc123def456789012345',
    sizes: ['thumbnail', 'medium']
  },
  createdAt: new Date().toISOString()
});
```

---

## 8. Troubleshooting

**Upload 400 "Unsupported file type"**: Client is sending a non-image MIME type. Accept only `image/jpeg`, `image/png`, or `image/webp`. Some clients incorrectly set `application/octet-stream` — the file must have the correct MIME type.

**Upload 400 from Multer "File too large"**: File exceeds 10 MB. Either compress the image before upload or the calling app needs to enforce size limits client-side.

**Worker job failing: Cloudinary credentials not set**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` are missing. The worker loads them lazily on first use — the error will appear in job failure logs. Set all three and restart.

**Worker job failing: "Failed to process variant"**: The image download from `imageUrl` may have timed out (30-second limit) or returned a non-image response. Check that the Cloudinary URL is publicly accessible. If `imageUrl` is a private/signed URL, it may have expired before the job was processed.

**MongoDB update fails after variant upload**: `entityId` is not a valid MongoDB ObjectId, or the entity does not exist in the expected collection. Check that `entityType` is one of `product`, `store`, `user` and that `entityId` is a valid 24-hex-char ObjectId string.

**`uploads/` directory missing**: On fresh deployment, `uploads/` is created at startup via `fs.mkdirSync`. If the process runs in a read-only filesystem (Docker, Render), set a writable volume mount at the working directory. Alternatively, uploads should be sent directly to Cloudinary and the HTTP upload server is not needed.

**Health server returns 503**: `setHealthy(false)` was called. This is not done automatically by the current code — it would be called by custom monitoring logic. Check application logs for the reason.

**Images not appearing on entities after processing**: The worker updates `images.thumbnail`, `images.medium`, `images.large` on the MongoDB document. Verify the `entityId` and `entityType` are correct. Check worker logs for the `[Worker] MongoDB document updated` log entry. Also ensure `MONGODB_URI` points to the same database as rez-backend.
