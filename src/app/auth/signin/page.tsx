'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInWireframe } from '@/components/forms/loading-states'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()
  const { signIn, signUp, user } = useAuth()

  // Simulate page load and check auth
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false)
    }, 1000)

    if (user) {
      console.log('User is authenticated, redirecting to dashboard...')
      router.push('/dashboard')
    }

    return () => clearTimeout(timer)
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setMessage('Email and password are required')
      setIsLoading(false)
      return
    }

    if (isSignUp && !name.trim()) {
      setMessage('Name is required for signup')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    try {
      console.log(`Attempting to ${isSignUp ? 'sign up' : 'sign in'} with:`, email)
      
      if (isSignUp) {
        await signUp(email, password, name)
        setMessage('Account created successfully! Redirecting...')
      } else {
        await signIn(email, password)
        setMessage('Signed in successfully! Redirecting...')
      }
      
      // Redirect will happen via useEffect when user state updates
    } catch (error: any) {
      console.error('Auth error:', error)
      setMessage(error.message || 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show wireframe while page is loading
  if (pageLoading) {
    return <SignInWireframe />
  }

  // Don't render if user is already authenticated
  if (user) {
    return <SignInWireframe />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="shadow-2xl border-0 bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-8">
            <div className="h-12 w-12 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-xl">X</span>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                {isSignUp ? 'Start your journey with Xeno' : 'Sign in to your Xeno dashboard'}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required={isSignUp}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                loading={isLoading}
                className="w-full h-12 text-base font-medium"
                variant="gradient"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="text-center space-y-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setMessage('')
                  setPassword('')
                  setName('')
                }}
                className="text-primary hover:text-primary/80 text-sm font-medium transition-colors duration-200"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>

              {message && (
                <div className={`text-sm p-4 rounded-xl font-medium ${
                  message.includes('successful') || message.includes('Redirecting') 
                    ? 'text-success bg-success/10 border border-success/20' 
                    : 'text-destructive bg-destructive/10 border border-destructive/20'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}