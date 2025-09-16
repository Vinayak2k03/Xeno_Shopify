# Xeno Shopify Service

A multi-tenant analytics dashboard and data ingestion service for Shopify stores. Built with Next.js, TypeScript, Prisma, and PostgreSQL.

---

## 🚀 Features Implemented

- **Multi-tenant support:** Manage and analyze multiple Shopify stores from a single dashboard.
- **Secure authentication:** JWT-based user authentication.
- **Shopify data sync:** Scheduled and manual sync for orders, customers, and products.
- **Analytics dashboard:** Visualize revenue, orders, customers, top products, and trends.
- **Custom events:** Track cart abandonment and checkout started events.
- **Real-time & scheduled sync:** Uses both webhooks (when enabled) and scheduled jobs for reliability.
- **Error handling & logging:** Sync logs and error tracking for all tenants.
- **Production-ready:** Optimized for deployment on Vercel or similar platforms.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** PostgreSQL (Neon, Supabase, or Render compatible)
- **Authentication:** JWT
- **Shopify API:** REST Admin API (2024-01)
- **Scheduling:** node-cron

---

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/xeno-shopify-service.git
cd xeno-shopify-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
SHOPIFY_API_VERSION=2024-01
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxx
RESEND_API_KEY=...
EMAIL_FROM=...
```

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Start the development server

```bash
npm run dev
```

---

## 🖥️ Usage

- **Login/Register:** Create an account and log in.
- **Add Shopify Store:** Connect your Shopify store(s) via the dashboard.
- **Sync Data:** Use the dashboard to trigger manual sync or wait for scheduled syncs.
- **View Analytics:** Explore revenue, orders, customers, and product analytics.
- **Custom Events:** See cart abandonment and checkout started events in the dashboard.

---

## 🗓️ Data Sync & Scheduling

- **Orders, Customers:** Synced every 15 minutes by default.
- **Products:** Synced every 30 minutes.
- **Analytics:** Synced hourly.
- **Manual Sync:** Trigger on-demand sync from the dashboard.
- **Sync Logs:** All syncs are logged for audit and troubleshooting.

---

## 🏗️ Deployment

### Deploy to Vercel

1. Import your repo on [Vercel](https://vercel.com).
2. Set all environment variables in the Vercel dashboard.
3. Deploy!

### Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- *(Optional)* `WEBHOOK_URL` (for webhooks, if enabled)

---

## 📝 Trade-offs & Approach

- **Performance:** Optimized with parallel queries, batching, and caching for fast dashboard loads.
- **Simplicity:** Focused on core analytics and sync reliability over advanced features.
- **Maintainability:** Modular code, clear separation of concerns, and strong typing.
- **Security:** All secrets in environment variables, JWT auth, and Shopify HMAC verification.

---

## 📊 Analytics Dashboard

- **Metrics:** Total revenue, orders, customers, and growth rates.
- **Trends:** Revenue and order trends over time.
- **Top Customers/Products:** Identify best customers and products.
- **Custom Events:** Cart abandonment and checkout started tracking.

---

## 🤝 Contributing

Pull requests and issues are welcome! Please open an issue to discuss your idea or bug before submitting a PR.

---

## 📄 License

MIT

---