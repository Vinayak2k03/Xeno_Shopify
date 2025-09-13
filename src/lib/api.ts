import { AuthService } from './auth'

interface FetchOptions extends RequestInit {
  requireAuth?: boolean
}

export async function apiRequest(url: string, options: FetchOptions = {}) {
  const { requireAuth = true, headers = {}, ...restOptions } = options
  
  // Get JWT token for authenticated requests
  let authHeaders = {}
  if (requireAuth) {
    const token = AuthService.getToken()
    if (token) {
      authHeaders = {
        'Authorization': `Bearer ${token}`,
      }
      console.log('Adding Authorization header to request')
    } else {
      console.warn('No auth token found for authenticated request')
    }
  }
  
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
    ...authHeaders,
  }
  
  console.log('Making API request to:', url)
  console.log('Headers:', Object.keys(finalHeaders))
  
  const response = await fetch(url, {
    ...restOptions,
    headers: finalHeaders,
    credentials: 'include', // Include httpOnly cookies
  })
  
  return response
}

// Convenience methods
export const api = {
  get: (url: string, options: FetchOptions = {}) => 
    apiRequest(url, { ...options, method: 'GET' }),
    
  post: (url: string, data?: any, options: FetchOptions = {}) => 
    apiRequest(url, { 
      ...options, 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  put: (url: string, data?: any, options: FetchOptions = {}) => 
    apiRequest(url, { 
      ...options, 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  delete: (url: string, options: FetchOptions = {}) => 
    apiRequest(url, { ...options, method: 'DELETE' }),
}