# AsyncWrap Error Solution - Migration Script Issue

## Problem Description

After processing approximately 5,491 items in the tag migration, the script
started failing with the following error:

```
❌ Error processing item (attempt 1/3): {
  error: "Failed to process item 38362: expected AsyncWrap",
  code: undefined,
  status: undefined,
  statusText: undefined
}
```

## Root Cause

The **"expected AsyncWrap"** error is a Deno/Node.js runtime error that occurs
when:

1. **Too many async operations** are pending simultaneously in the JavaScript
   runtime
2. **Socket/file descriptor exhaustion** - the runtime runs out of handles for
   tracking async operations
3. **Event loop saturation** - the runtime can't allocate more async operation
   wrappers
4. **Garbage collection lag** - async handles and socket references accumulate
   faster than GC can clean them up

### Why This Happened

- Using **axios with Node.js compatibility layer** in Deno
- Processing batches with **high concurrency** (25-50 concurrent requests)
- **Insufficient delay** between batches for connections to close and GC to run
- Accumulated socket references and async handles over thousands of operations

## Initial Attempts (Did Not Fully Solve)

### 1. HTTP Agent Configuration ❌

Added Node.js HTTP agents with connection pooling:

```typescript
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});
```

**Result**: Helped slightly but didn't prevent the AsyncWrap error

### 2. Reduced Concurrency ❌

- Lowered from 50 to 25 concurrent requests
- Increased batch delay from 200ms to 500ms **Result**: Delayed the problem but
  still occurred around 5,491 items

### 3. Connection Close Headers ❌

Added response interceptor to force connection closure **Result**: Minimal
impact

## The Solution ✅

### Aggressive Garbage Collection

Force garbage collection periodically between batches to clean up accumulated
async handles and socket references.

#### Implementation

**1. Update `src/utils/batch-processor.ts`:**

```typescript
// In processBatch function, after onProgress callback
if (onProgress) {
  onProgress(stats);
}

// Force garbage collection every 10 batches
if ((batchIndex + 1) % 10 === 0) {
  console.log("🗑️  Triggering garbage collection...");
  if (globalThis.gc) {
    globalThis.gc();
  }
  await sleep(1000); // Give time for cleanup
}
```

**2. Update `deno.json` to expose GC:**

```json
{
  "tasks": {
    "start:local": "deno run --allow-read --allow-write --allow-net --allow-env --v8-flags=--expose-gc --env-file=.env.local ./src/main.ts",
    "start:prod": "deno run --allow-read --allow-write --allow-net --allow-env --v8-flags=--expose-gc --env-file=.env.production ./src/main.ts"
  }
}
```

#### Why This Works

1. **Explicit GC triggers** force cleanup of dead socket references
2. **1-second pause** gives runtime time to:
   - Close unused connections
   - Free async operation handles
   - Release promise memory
   - Reset event loop state
3. **Every 10 batches** balances performance vs stability

## Results

✅ Successfully processed all tags without AsyncWrap errors ✅ Memory and socket
handles stay within runtime limits ✅ Predictable performance with periodic GC
pauses

## Performance Tuning

Adjust GC frequency based on dataset size:

- **Every 5 batches**: More stable, slower (for very large datasets)
- **Every 10 batches**: Balanced (current setting) ✅
- **Every 20 batches**: Faster but riskier for huge datasets

## Alternative Solution (Not Implemented)

### Switch to Deno's Native `fetch`

For long-term stability, consider replacing axios with Deno's native `fetch`
API:

**Benefits:**

- Native connection pooling designed for Deno
- No Node.js compatibility layer overhead
- Better async operation management
- Automatic resource cleanup

**Implementation:** Replace axios client in `src/cms/strapi5.ts` with a
fetch-based wrapper:

```typescript
const client = {
  async request<T>(
    method: string,
    path: string,
    data?: unknown,
    params?: Record<string, string>,
  ) {
    const url = new URL(path, config.strapi5.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Authorization": `Bearer ${config.strapi5.token}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  },
};
```

## Current Configuration

```typescript
// config/index.ts
migration: {
  concurrency: 25,        // Concurrent requests
  batchSize: 100,         // Items per batch
  maxRetries: 3,          // Retry attempts
  batchDelayMs: 500,      // Delay between batches
}

// GC trigger: Every 10 batches with 1-second pause
```

## Related Issues

- Graceful shutdown implementation (SIGINT handling)
- Batch processing with concurrency control
- Retry logic with exponential backoff
- Progress tracking and state persistence

## Date

October 26, 2025
