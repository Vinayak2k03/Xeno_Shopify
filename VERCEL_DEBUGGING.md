# 🚀 Vercel Deployment Debugging Guide

## Issue: Sync works locally but fails on Vercel deployment

### 📋 Troubleshooting Steps

#### 1. **Deploy Enhanced Version**
```bash
git add .
git commit -m "Add deployment debugging and timeout configuration"
git push
```

#### 2. **Test Environment Variables**
After deployment, visit: `https://your-app.vercel.app/api/debug/env`

This will show:
- ✓ Environment variables are properly set
- ✗ Missing variables that need to be configured in Vercel dashboard

#### 3. **Test Shopify API Connectivity**
Make a POST request to: `https://your-app.vercel.app/api/debug/shopify`
```json
{
  "tenantId": "your-tenant-id"
}
```

This will test:
- Shop info retrieval
- Order count fetching
- First page of orders

#### 4. **Monitor Sync Logs**
When triggering sync, check Vercel function logs for:
- `[SYNC API]` - API endpoint logs
- `[SHOPIFY SERVICE]` - Shopify API interaction logs
- `[SYNC ORDERS]` - Order sync specific logs

#### 5. **Common Issues & Solutions**

**🔍 Issue: Function Timeout**
- **Symptom**: Sync stops after 25-30 seconds
- **Solution**: We added `vercel.json` with 300s timeout for sync endpoint
- **Check**: Vercel dashboard → Functions → Check max duration

**🔍 Issue: Environment Variables**
- **Symptom**: Database/Auth errors
- **Check**: Vercel dashboard → Settings → Environment Variables
- **Required**:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - Any Shopify-specific variables

**🔍 Issue: Database Connection**
- **Symptom**: Prisma connection errors
- **Solution**: Ensure DATABASE_URL is correctly set and accessible from Vercel
- **Test**: Visit `/api/debug/env` to verify connection

**🔍 Issue: Shopify API Limits**
- **Symptom**: Rate limiting errors in logs
- **Solution**: Our code includes rate limiting and retries
- **Check**: Look for "rate limit" in function logs

**🔍 Issue: Network/DNS**
- **Symptom**: Failed to fetch from Shopify
- **Test**: Use `/api/debug/shopify` endpoint
- **Solution**: Usually resolves automatically

#### 6. **Performance Optimizations Added**

✅ **Timeout Configuration**
- 300 seconds for sync endpoint
- 60 seconds for other API routes

✅ **Enhanced Logging**
- Detailed progress tracking
- Error context and timing
- Environment validation

✅ **Error Handling**
- Graceful timeout handling
- Detailed error messages
- Development vs production error details

✅ **Rate Limiting**
- Built-in Shopify API rate limit handling
- Automatic retries with backoff

### 🔧 Next Steps

1. **Deploy the updated code**
2. **Test environment endpoint**: `/api/debug/env`
3. **Test Shopify connectivity**: `/api/debug/shopify`
4. **Try a manual sync and monitor logs**
5. **Report specific error messages if issues persist**

### 📊 Expected Behavior

**Local Development**: ✅ Working perfectly
**Vercel Deployment**: 🔄 Should now work with enhanced debugging

The enhanced logging will help identify the exact point of failure in the production environment.