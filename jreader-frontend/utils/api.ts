
export function getBackendApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
  }
  return apiUrl;
}

// Cache for admin status to prevent redundant API calls
let adminStatusCache: { isAdmin: boolean; timestamp: number } | null = null;
const ADMIN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function checkAdminStatus(): Promise<boolean> {
  // Check if we have a valid cached result
  if (adminStatusCache && (Date.now() - adminStatusCache.timestamp) < ADMIN_CACHE_DURATION) {
    console.log('🔍 API: Using cached admin status:', adminStatusCache.isAdmin);
    return adminStatusCache.isAdmin;
  }

  try {
    console.log('🔍 API: Checking admin status...');
    const response = await fetch('/api/check-admin', {
      method: 'GET',
      credentials: 'include' // Include cookies for authentication
    });
    
    if (response.ok) {
      const data = await response.json()
      const isAdmin = data.isAdmin
      
      // Cache the result
      adminStatusCache = {
        isAdmin,
        timestamp: Date.now()
      };
      
      console.log('🔍 API: Admin status cached:', isAdmin);
      return isAdmin
    } else {
      console.log('❌ Admin check failed with status:', response.status)
      return false
    }
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return false;
  }
}

// Function to clear admin cache (useful for testing or when user logs out)
export function clearAdminCache(): void {
  adminStatusCache = null;
  console.log('🔍 API: Admin cache cleared');
} 