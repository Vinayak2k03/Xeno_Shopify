import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Configure for serverless environments
  ...(process.env.VERCEL ? {
    transactionOptions: {
      timeout: 30000, // 30 seconds
    },
  } : {}),
})

// Ensure clean connections in serverless
if (process.env.VERCEL) {
  // Add connection pool settings for Vercel
  prisma.$connect().catch((error) => {
    console.error('Prisma connection error:', error)
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma