# Shopify Data Sync System - Complete Guide

## Overview

This comprehensive sync system keeps your Shopify data in perfect sync with your application using both scheduled sync jobs and real-time webhooks. The system provides automatic data synchronization, monitoring, and management capabilities.

## Features

### ✅ **Enhanced Scheduler System**
- **Multiple Sync Schedules**: Different intervals for different data types
- **Rate Limiting**: Respects Shopify API limits with intelligent batching
- **Retry Logic**: Exponential backoff with configurable retry attempts
- **Error Handling**: Comprehensive error logging and recovery
- **Incremental Sync**: Only syncs changed data to improve performance

### ✅ **Webhook Registration System**
- **Automatic Registration**: Registers all necessary webhooks automatically
- **Real-time Sync**: Immediate data updates via webhooks
- **Webhook Management**: Easy registration, updating, and monitoring
- **Security**: HMAC signature verification for all webhook requests

### ✅ **Security & Verification**
- **HMAC Verification**: Validates webhook authenticity
- **Rate Limiting**: Prevents webhook spam and abuse
- **Request Validation**: Comprehensive payload and header validation
- **Error Isolation**: Isolated error handling prevents cascading failures

### ✅ **Incremental Sync Logic**
- **Smart Syncing**: Only fetches data modified since last sync
- **Timestamp Tracking**: Tracks last sync times for each data type
- **Batch Processing**: Efficient batch operations for large datasets
- **Performance Optimization**: Reduces API calls and improves speed

### ✅ **Comprehensive Monitoring**
- **Sync Metrics**: Detailed performance and success metrics
- **Webhook Health**: Monitor webhook status and performance
- **Data Health**: Track record counts and data freshness
- **Performance Analytics**: Sync efficiency and frequency analysis

### ✅ **Management APIs**
- **Manual Sync**: Trigger syncs on-demand via API
- **Status Checking**: Get detailed sync status and history
- **Webhook Management**: Register, update, and monitor webhooks
- **Configuration**: Flexible sync configuration options

## Getting Started

### 1. Environment Setup

Ensure these environment variables are configured:

```env
DATABASE_URL="your-postgresql-connection-string"
NEXTAUTH_URL="https://yourdomain.com"
SHOPIFY_API_VERSION="2024-01"
```

### 2. Database Migration

Run the migration to add sync logging:

```bash
npx prisma migrate dev --name add_sync_logs
```

### 3. Start the Scheduler

Add to your main application startup (e.g., `app/layout.tsx` or server startup):

```typescript
import { startScheduler } from '@/lib/scheduler'

// Start the scheduler in production
if (process.env.NODE_ENV === 'production') {
  startScheduler()
}
```

### 4. Register Webhooks for Tenants

#### Automatic Registration (Recommended)
```typescript
import { webhookManager } from '@/lib/webhook-manager'

// Register webhooks for all tenants
const results = await webhookManager.registerWebhooksForAllTenants()

// Register webhooks for specific tenant
const result = await webhookManager.registerWebhooksForTenant(tenantId)
```

#### Via API
```bash
# Register webhooks
curl -X POST /api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "tenant-id", "action": "register"}'

# Check webhook status
curl -X GET "/api/webhooks?tenantId=tenant-id"
```

## API Reference

### Sync Management

#### Manual Sync Trigger
```bash
POST /api/sync
{
  "tenantId": "tenant-id",
  "types": ["orders", "customers", "products"],  // optional
  "force": true  // optional, bypasses time checks
}
```

#### Get Sync Status
```bash
GET /api/sync?tenantId=tenant-id
```

Response includes:
- Recent sync logs
- Success rates by type
- Last sync times
- Error details
- Webhook status

### Webhook Management

#### Register Webhooks
```bash
POST /api/webhooks
{
  "tenantId": "tenant-id",
  "action": "register"  // "register", "unregister", "update"
}
```

#### Get Webhook Status
```bash
GET /api/webhooks?tenantId=tenant-id
```

#### Check Webhook Health
```bash
PUT /api/webhooks/health
```

### Monitoring & Metrics

#### Get Comprehensive Metrics
```bash
GET /api/dashboard/sync-metrics?tenantId=tenant-id&days=7
```

Returns:
- Sync performance metrics
- Webhook event statistics
- Data health indicators
- Performance analytics

## Sync Schedules

The system uses different schedules for different data types:

| Data Type | Schedule | Interval |
|-----------|----------|----------|
| Orders | `*/15 * * * *` | Every 15 minutes |
| Customers | `*/15 * * * *` | Every 15 minutes |
| Products | `*/30 * * * *` | Every 30 minutes |
| Analytics | `0 * * * *` | Every hour |
| Cleanup | `0 2 * * *` | Daily at 2 AM |

## Webhook Events

The system automatically registers these webhooks:

### Order Events
- `orders/create` - New order created
- `orders/updated` - Order updated
- `orders/paid` - Order payment completed
- `orders/cancelled` - Order cancelled

### Customer Events
- `customers/create` - New customer registered
- `customers/update` - Customer information updated

### Product Events
- `products/create` - New product added
- `products/update` - Product information updated

### Cart & Checkout Events
- `carts/create` - Cart created
- `carts/update` - Cart modified
- `checkouts/create` - Checkout started
- `checkouts/update` - Checkout updated

## Monitoring Dashboard Integration

### Add Sync Status to Your Dashboard

```typescript
import { useEffect, useState } from 'react'

function SyncStatusWidget({ tenantId }) {
  const [syncStatus, setSyncStatus] = useState(null)

  useEffect(() => {
    fetch(`/api/sync?tenantId=${tenantId}`)
      .then(res => res.json())
      .then(setSyncStatus)
  }, [tenantId])

  if (!syncStatus) return <div>Loading...</div>

  return (
    <div className="sync-status">
      <h3>Sync Status</h3>
      <div className="metrics">
        {Object.entries(syncStatus.syncStatus).map(([type, status]) => (
          <div key={type} className="metric">
            <span>{type}</span>
            <span className={status.success ? 'success' : 'error'}>
              {status.success ? '✅' : '❌'}
            </span>
            <span>{status.recordsProcessed} records</span>
            <span>{status.lastSync}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Manual Sync Button

```typescript
async function triggerManualSync(tenantId) {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, force: true })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`Synced ${result.totalRecords} records in ${result.totalDuration}ms`)
    }
  } catch (error) {
    console.error('Sync failed:', error)
  }
}
```

## Performance Optimization

### Incremental Sync
The system automatically uses incremental sync:
- Tracks last sync time for each data type
- Only fetches data modified since last sync
- Reduces API calls and improves performance

### Rate Limiting
- Respects Shopify API limits (40 requests/second)
- Batches operations to avoid overwhelming the API
- Implements exponential backoff for retries

### Error Handling
- Isolates errors to prevent cascading failures
- Logs all sync attempts for debugging
- Continues processing other tenants if one fails

## Troubleshooting

### Common Issues

1. **Webhooks Not Working**
   - Check webhook secret is configured
   - Verify NEXTAUTH_URL is correct
   - Check webhook registration status via API

2. **Sync Failures**
   - Check Shopify access token is valid
   - Verify API permissions
   - Review sync logs in database

3. **Performance Issues**
   - Check if incremental sync is working
   - Monitor API rate limits
   - Review batch sizes in scheduler

### Debug Commands

```bash
# Check sync logs
curl -X GET "/api/sync?tenantId=tenant-id"

# Check webhook health
curl -X PUT "/api/webhooks/health"

# Get detailed metrics
curl -X GET "/api/dashboard/sync-metrics?tenantId=tenant-id&days=1"
```

## Database Schema

### SyncLog Table
```sql
CREATE TABLE sync_logs (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  sync_type VARCHAR NOT NULL,
  success BOOLEAN NOT NULL,
  records_processed INTEGER DEFAULT 0,
  duration INTEGER NOT NULL,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Next Steps

1. **Set up monitoring alerts** for failed syncs
2. **Configure webhook endpoints** in your Shopify admin
3. **Test the system** with real Shopify data
4. **Monitor performance** and adjust schedules as needed
5. **Set up notifications** for sync failures

The system is now fully operational and will keep your Shopify data synchronized automatically!