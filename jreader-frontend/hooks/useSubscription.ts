import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

interface SubscriptionData {
  tier: number;
  isSubscribed: boolean;
}

export function useSubscription() {
  const { user: authUser } = useAuth();
  
  return useQuery<SubscriptionData>({
    queryKey: ['subscription', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) {
        return { tier: 0, isSubscribed: false };
      }
      
      console.log('useSubscription: Fetching user subscription for:', authUser.id);
      
      const supabase = createClient();
      const { data, error } = await supabase
        .from('Users')
        .select('tier')
        .eq('id', authUser.id)
        .single();
      
      if (error) {
        console.error('useSubscription: Error fetching user tier:', {
          userId: authUser.id,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        // Default to free tier if user not found in Users table
        return { tier: 0, isSubscribed: false };
      }
      
      const tier = data?.tier || 0;
      const isSubscribed = tier >= 1; // 0 = free, 1+ = pro
      
      console.log('useSubscription: Subscription data fetched:', { tier, isSubscribed });
      
      return { tier, isSubscribed };
    },
    enabled: !!authUser?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
} 