'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    
    if (user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect to dashboard
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Xeno Shopify Service
        </h1>
        <p className="text-lg text-gray-600">
          Multi-tenant Shopify Data Ingestion & Insights Platform
        </p>
        <div className="space-y-4">
          <Button 
            onClick={() => router.push('/auth/signin')}
            className="w-full"
          >
            Get Started
          </Button>
        </div>
        <div className="text-sm text-gray-500">
          Built for the Xeno FDE Internship Assignment
        </div>
      </div>
    </div>
  )
}
