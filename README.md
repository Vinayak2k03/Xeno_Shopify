# Xeno Shopify Service

A multi-tenant Shopify Data Ingestion & Insights Service built for the Xeno FDE Internship Assignment.

## 🚀 Features

- **Multi-tenant Architecture**: Isolated data per Shopify store
- **Real-time Data Sync**: Webhooks + scheduled sync jobs
- **Insights Dashboard**: Customer, order, and revenue analytics
- **Email Authentication**: Secure access with NextAuth.js
- **Shopify Integration**: Complete API integration with error handling

## 🛠️ Tech Stack

- **Backend**: Next.js 14 (App Router), TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with email provider
- **Frontend**: React 18, Tailwind CSS, Recharts
- **API Integration**: Shopify Admin API
- **Deployment**: Vercel (Frontend) + Railway (Database)

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Shopify development store
- Email service (Gmail/SendGrid) for authentication

## 🏗️ Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd shopify-service
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/shopify_service_db"

# NextAuth.js
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Shopify Configuration
SHOPIFY_API_VERSION="2024-01"

# Email Configuration (for authentication)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="your-email@gmail.com"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) View database
npx prisma studio
```

### 4. Shopify Store Setup

1. **Create Development Store**:
   - Go to [partners.shopify.com](https://partners.shopify.com)
   - Create a development store with dummy data

2. **Create Private App**:
   - In your store admin: Settings → Apps → Develop apps
   - Create app with scopes: `read_customers`, `read_orders`, `read_products`
   - Copy the access token

3. **Configure Webhooks** (Optional):
   - Add webhook endpoints pointing to `/api/webhooks/shopify`

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and:
1. Sign in with your email
2. Add your Shopify store configuration
3. Sync data and explore the dashboard

## 📊 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Shopify API   │    │   Next.js App    │    │   PostgreSQL    │
│                 │───▶│                  │───▶│                 │
│ - Customers     │    │ - Authentication │    │ - Multi-tenant  │
│ - Orders        │    │ - Dashboard      │    │ - Relationships │
│ - Products      │    │ - API Routes     │    │ - Indexes       │
│ - Webhooks      │    │ - Sync Service   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Database Schema

**Core Tables**:
- `tenants`: Store configurations
- `customers`: Shopify customer data
- `orders`: Order information with line items
- `products`: Product catalog
- `custom_events`: Cart/checkout tracking

**Authentication Tables** (NextAuth.js):
- `users`, `accounts`, `sessions`, `verification_tokens`

## 🔌 API Endpoints

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth.js endpoints

### Tenant Management
- `GET /api/tenants` - List user's tenants
- `POST /api/tenants` - Create new tenant

### Data Operations
- `POST /api/sync` - Sync Shopify data
- `GET /api/dashboard/metrics` - Dashboard analytics

### Webhooks
- `POST /api/webhooks/shopify` - Shopify webhook handler

## 📈 Dashboard Features

### Metrics Cards
- Total customers, orders, revenue
- Monthly growth indicators
- Average order value

### Charts & Analytics
- Orders and revenue over time (line chart)
- Top 5 customers by spend
- Date range filtering

### Data Management
- One-click data sync
- Real-time webhook updates
- Multi-tenant data isolation

## 🔄 Data Sync Strategy

**Initial Sync**: Manual trigger via dashboard
**Incremental Sync**: 
- Webhooks for real-time updates
- Scheduled sync every 30 minutes (production)
- Handles rate limits and errors gracefully

## 🚀 Deployment

### Database (Railway)
1. Create PostgreSQL instance on Railway
2. Copy connection string to `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`

### Application (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy

### Post-Deployment
1. Configure webhooks to point to your domain
2. Test authentication and sync
3. Set up monitoring

## 🔍 Testing

### Manual Testing Steps
1. **Authentication**: Email sign-in flow
2. **Tenant Creation**: Add Shopify store
3. **Data Sync**: Initial sync + webhooks
4. **Dashboard**: Verify metrics and charts
5. **Multi-tenancy**: Multiple stores isolation

### Sample Data
The app works with Shopify's development store dummy data or your own test data.

## ⚠️ Known Limitations

1. **Rate Limits**: Shopify API limits (40 calls/app/minute)
2. **Real-time Updates**: Webhook delivery not guaranteed
3. **Data Validation**: Basic validation, could be enhanced
4. **Error Handling**: Logs errors but limited retry logic
5. **Scalability**: Single-instance design, needs queue for scale

## 🔧 Production Considerations

### Security
- [ ] Webhook signature verification
- [ ] Rate limiting on API endpoints
- [ ] Input validation and sanitization
- [ ] Environment variable validation

### Performance
- [ ] Database connection pooling
- [ ] Caching layer (Redis)
- [ ] Background job queue
- [ ] CDN for static assets

### Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Webhook delivery monitoring
- [ ] Health checks

### Scalability
- [ ] Horizontal scaling with load balancer
- [ ] Database read replicas
- [ ] Message queue for async processing
- [ ] Microservices architecture

## 🎯 Next Steps for Production

1. **Enhanced Security**: OAuth flow, RBAC, audit logging
2. **Advanced Analytics**: Custom date ranges, cohort analysis
3. **Data Export**: CSV/Excel export functionality
4. **Notification System**: Email alerts for sync failures
5. **Admin Panel**: Tenant management, system monitoring
6. **API Documentation**: OpenAPI/Swagger specs
7. **Testing Suite**: Unit, integration, and E2E tests

## 📝 Development Notes

### Key Design Decisions
- **Multi-tenancy**: Row-level security with tenant_id
- **Real-time Updates**: Webhooks + fallback polling
- **Authentication**: Email-only (simpler than OAuth)
- **UI Framework**: Custom components (no external lib)

### Trade-offs Made
- **Simplicity vs Features**: Basic features well-implemented
- **Performance vs Development Speed**: Optimized for dev speed
- **Security vs Usability**: Email auth vs full OAuth

## 📞 Support

For questions about this implementation:
- Check the code comments for implementation details
- Review the Shopify API documentation
- Test with development store data first

---

**Built for Xeno FDE Internship Assignment 2025**
