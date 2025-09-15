# 🚀 Vercel Deployment Guide

## Step 1: Deploy to Vercel

1. **Import your GitHub repository** to Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Git Repository"
   - Select your `Xeno_Shopify` repository

2. **Configure Build Settings** (should be auto-detected):
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

## Step 2: Add Environment Variables

In the Vercel dashboard, go to **Settings > Environment Variables** and add:

### Required Environment Variables:
```
DATABASE_URL = your_neon_database_url_here

JWT_SECRET = your-super-secret-jwt-key-change-in-production

JWT_EXPIRES_IN = 7d

SHOPIFY_API_VERSION = 2024-01

SHOPIFY_STORE_DOMAIN = your-store.myshopify.com

SHOPIFY_ACCESS_TOKEN = your_shopify_access_token_here

RESEND_API_KEY = your_resend_api_key_here

EMAIL_FROM = your_email@domain.com
```

### Important Notes:
- Set all variables for **Production**, **Preview**, and **Development** environments
- Replace placeholder values with your actual credentials
- The WEBHOOK_URL will be set after deployment (see step 4)

## Step 3: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for the build to complete
3. Your app will be available at: `https://your-app-name.vercel.app`

## Step 4: Update Webhook URL

Once deployed, add one more environment variable:

```
WEBHOOK_URL = https://your-deployed-app.vercel.app
```

Then **redeploy** the application.

## Step 5: Test Your Deployment

1. Visit your deployed URL
2. Test the authentication (sign up/sign in)
3. Test the dashboard
4. Check webhook registration

## Common Issues & Solutions

### Database Connection Issues:
- Neon databases can sleep on free tier
- If connection fails, try accessing any API endpoint to wake it up
- Check if your Neon database is still active

### Build Failures:
- Check the build logs in Vercel dashboard
- Ensure all environment variables are set correctly
- TypeScript errors are already fixed

### 404 Errors:
- Make sure the repository structure is correct
- Check that all API routes are in the correct folders

## Next Steps After Deployment

1. **Register Webhooks**: Use the deployed HTTPS URL to register Shopify webhooks
2. **Test Custom Events**: Verify cart abandonment and checkout tracking work
3. **Monitor Performance**: Check dashboard load times and API responses

Your Shopify Service should now be fully deployed and functional! 🎉