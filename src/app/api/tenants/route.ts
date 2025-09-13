import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

const createTenantSchema = z.object({
  name: z.string().min(1),
  shopifyDomain: z.string().min(1),
  shopifyAccessToken: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    console.log('Authenticated user:', user)
    
    if (!user) {
      console.log('No authenticated user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenants = await prisma.tenant.findMany({
      where: {
        userId: user.id // Use user.id instead of user.$id
      },
      select: {
        id: true,
        name: true,
        shopifyDomain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createTenantSchema.parse(body)

    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: {
        shopifyDomain: validatedData.shopifyDomain
      }
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Shopify domain already exists' }, 
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.create({
      data: {
        ...validatedData,
        userId: user.id // Use user.id instead of user.$id
      }
    })

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors }, 
        { status: 400 }
      )
    }
    
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}