'use client';

import { CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ExtensionIndicator } from '@/components/ExtensionIndicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/client';

export default function ExtAuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nonce = searchParams.get('nonce');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [message, setMessage] = useState('');
  const [errorType, setErrorType] = useState<'auth' | 'network' | 'general'>('general');

  useEffect(() => {
    console.log('ExtAuthPage useEffect triggered');
    console.log('Nonce from URL:', nonce);
    
    if (!nonce) {
      console.log('No nonce provided, setting error status');
      setStatus('error');
      setMessage('No nonce provided');
      setErrorType('general');
      return;
    }

    console.log('Starting completePairing function');
    const completePairing = async () => {
      try {
        console.log('Completing pairing for nonce:', nonce);
        
        // Check if user is authenticated first
        const supabase = createClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.log('Error getting session:', sessionError);
          setStatus('error');
          setMessage('Failed to get user session');
          setErrorType('general');
          return;
        }
        
        if (!session) {
          console.log('No session found - user not authenticated');
          setStatus('error');
          setMessage('You must be logged in to pair your device. Please log in first.');
          setErrorType('auth');
          return; // Don't throw, just return
        }
        
        console.log('User is authenticated:', session.user?.id);
        console.log('Making fetch request to /api/ext-auth/complete');
        
        // Call the complete endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          console.log('Making request to /api/ext-auth/complete with nonce:', nonce);
          const response = await fetch('/api/ext-auth/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nonce }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log('Complete endpoint response status:', response.status);
          console.log('Complete endpoint response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            const errorText = await response.text();
            console.log('Complete endpoint error response:', errorText);
            setStatus('error');
            setMessage(`Complete request failed: ${response.status} ${response.statusText} - ${errorText}`);
            setErrorType('general');
            return;
          }

          const responseData = await response.json();
          console.log('Complete endpoint response data:', responseData);

          if (responseData.ok) {
            setStatus('success');
            setMessage('Device paired successfully! You can close this tab manually.');
            
            // Send nonce first, then session data
            if (responseData.session_data) {
              console.log('Sending nonce to extension first:', nonce);
              window.postMessage({
                type: 'PAIR_NONCE',
                nonce: nonce
              }, window.location.origin);
              
              // Send session data after a short delay to ensure nonce is received
              setTimeout(() => {
                console.log('Sending session data to extension:', responseData.session_data);
                window.postMessage({
                  type: 'SET_SUPABASE_SESSION',
                  nonce: nonce,
                  session: responseData.session_data
                }, window.location.origin);
                
                // Check if extension received the messages after a delay
                setTimeout(() => {
                  console.warn('⚠️ If you see "Pairing in progress..." in the extension popup, check:');
                  console.warn('1. Extension console for content-bridge loading messages');
                  console.warn('2. This page console for content-bridge received message logs');
                  console.warn('3. Make sure the extension manifest allows this URL:', window.location.origin);
                }, 2000);
              }, 100);
            }
          } else {
            setStatus('error');
            setMessage('Server returned error response');
            setErrorType('general');
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.log('Fetch error:', fetchError);
          
          if (fetchError.name === 'AbortError') {
            setStatus('error');
            setMessage('Request timed out - server may be unreachable');
            setErrorType('network');
          } else if (fetchError.message.includes('Failed to fetch')) {
            setStatus('error');
            setMessage('Network error - server may be unreachable or URL is incorrect');
            setErrorType('network');
          } else {
            setStatus('error');
            setMessage(fetchError.message || 'Network error occurred');
            setErrorType('network');
          }
        }
        
      } catch (error) {
        // This should rarely be reached now since we handle most cases above
        console.log('Unexpected error completing pairing:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
        setErrorType('general');
      }
    };

    completePairing();
  }, [nonce]);

  const handleLoginRedirect = () => {
    if (!nonce) return;
    
    // Store the current URL (with nonce) for redirect after login
    const currentUrl = `${window.location.pathname}?nonce=${nonce}`;
    const redirectUrl = encodeURIComponent(currentUrl);
    
    // Redirect to login with the current URL as redirect parameter
    router.push(`/login?redirect=${redirectUrl}`);
  };

  const handleRetry = () => {
    setStatus('loading');
    setMessage('');
    setErrorType('general');
    
    // Retry the pairing process
    window.location.reload();
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Hidden ExtensionIndicator to listen for pairing updates */}
      <div className="hidden">
        <ExtensionIndicator />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">JReader Device Pairing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground">Completing device pairing...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-green-600">Success!</h3>
                <p className="text-muted-foreground">{message}</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-destructive">Error</h3>
                  <p className="text-muted-foreground">{message}</p>
                </div>
                
                {errorType === 'auth' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      You need to be logged in to pair your device with JReader.
                    </p>
                    <Button onClick={handleLoginRedirect} className="w-full">
                      <LogIn className="h-4 w-4 mr-2" />
                      Log In & Continue Pairing
                    </Button>
                  </div>
                )}
                
                {errorType === 'network' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      There was a network issue. Please check your connection and try again.
                    </p>
                    <Button onClick={handleRetry} variant="outline" className="w-full">
                      Try Again
                    </Button>
                  </div>
                )}
                
                {errorType === 'general' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Something went wrong. Please try again or contact support if the issue persists.
                    </p>
                    <Button onClick={handleRetry} variant="outline" className="w-full">
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
