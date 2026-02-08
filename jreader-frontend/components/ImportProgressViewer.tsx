'use client';

import { ChevronDown, ChevronUp, X, Download, AlertCircle, CheckCircle, Clock, Loader2, Upload, Settings, ExternalLink } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getBackendApiUrl } from '@/utils/api';
import { formatDisplayTitle, fetchBookMetadataForNewImports } from '@/utils/importDisplay';
import type { ImportProgress} from '@/utils/importProgress';
import { fetchImportProgress, cancelImport, clearCompletedImports } from '@/utils/importProgress';
import { getMetadata } from '@/utils/supabase/client';
import type { SyosetuApiResponse } from '@/utils/syosetuApi';

// Helper function to handle Next.js API upload when import is complete
const handleCompletedImport = async (importId: string, url: string) => {
  try {
    console.log('=== Handling completed import ===');
    console.log('Import ID:', importId);
    console.log('URL:', url);

    // Get auth metadata
    const metadata = await getMetadata();
    
    // Call GET endpoint to fetch the completed import data
    const apiUrl = `${getBackendApiUrl()}/api/webnovel?url=${encodeURIComponent(url)}`;
    console.log('Fetching completed import from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${metadata.accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Failed to fetch completed import:', errorText);
      
      // If the file doesn't exist (404), it means it was already processed
      if (response.status === 404) {
        console.log('EPUB file not found - import was already processed');
        return true; // Consider this a success since it was already handled
      }
      
      throw new Error(`Failed to fetch completed import: ${response.statusText}`);
    }

    // Parse the response to get metadata and filename
    console.log('Parsing completed import response');
    const result = await response.json();
    console.log('Completed import result keys:', Object.keys(result));
    console.log('Metadata:', result.metadata);
    console.log('Filename:', result.filename);
    
    // Create form data for the Next.js API
    console.log('Creating form data for Next.js API');
    const formData = new FormData();
    formData.append('bookMetadata', JSON.stringify(result.metadata));
    formData.append('originalUrl', url); // Add original syosetu URL for webnovel storage
    formData.append('importId', result.import_id); // Add import ID for progress tracking
    formData.append('authToken', metadata.accessToken); // Add auth token for progress updates
    formData.append('epubFilename', result.filename); // Add EPUB filename for server-side fetching
    console.log('Form data created with metadata:', result.metadata);
    console.log('Original URL added:', url);
    console.log('Import ID added:', result.import_id);
    console.log('Auth token added:', !!metadata.accessToken);
    console.log('EPUB filename added:', result.filename);

    // Send to our Next.js API route
    console.log('Sending to Next.js API');
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    console.log('Next.js API response status:', uploadResponse.status);
    console.log('Next.js API response ok:', uploadResponse.ok);

    const uploadResponseText = await uploadResponse.text();
    console.log('Next.js API response text length:', uploadResponseText.length);
    
    let uploadResult;
    try {
      uploadResult = JSON.parse(uploadResponseText);
      console.log('Next.js API parsed result:', uploadResult);
    } catch (e) {
      console.log('Failed to parse Next.js API response:', e);
      throw new Error(`Server returned invalid JSON: ${uploadResponseText.slice(0, 200)}...`);
    }

    if (!uploadResponse.ok) {
      const errorMessage = uploadResult.error || `Upload failed: ${uploadResponse.statusText}`;
      console.log('Next.js API error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('Next.js API upload successful');
    console.log('=== Completed import handling finished successfully ===');
    
    return true;
  } catch (error: any) {
    console.log('=== Completed import handling failed ===');
    console.log('Error:', error);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.error('Completed import handling error:', error);
    toast.error(`Failed to process completed import: ${error.message}`);
    return false;
  }
};

interface ImportProgressViewerProps {
  onImportComplete?: () => void;
  triggerPolling?: boolean; // When this changes to true, start polling
  onPollingComplete?: () => void; // Callback when polling should stop
  onImportCancelled?: () => void; // Callback when an import is cancelled
}

export default function ImportProgressViewer({ onImportComplete, triggerPolling, onPollingComplete, onImportCancelled }: ImportProgressViewerProps) {
  console.log('🔄 ImportProgressViewer component rendered with triggerPolling:', triggerPolling);
  
  const [imports, setImports] = useState<ImportProgress[]>([]);
  const [expandedImports, setExpandedImports] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const [completedImports, setCompletedImports] = useState<Set<string>>(new Set());
  const [toastShown, setToastShown] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [bookMetadata, setBookMetadata] = useState<Map<string, SyosetuApiResponse>>(new Map());
  const [fetchingMetadata, setFetchingMetadata] = useState<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const onImportCompleteRef = useRef(onImportComplete);
  const onImportCancelledRef = useRef(onImportCancelled);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const importsRef = useRef<ImportProgress[]>([]);

  // Helper function to normalize status to string
  const getStatusString = (status: ImportProgress['status']): string => {
    if (typeof status === 'string') {
      return status;
    } else if (typeof status === 'object' && 'Failed' in status) {
      return 'Failed';
    }
    return 'Unknown';
  };

  // Helper function to get error message from Failed status
  const getErrorMessage = (status: ImportProgress['status']): string | null => {
    if (typeof status === 'object' && 'Failed' in status) {
      return status.Failed;
    }
    return null;
  };

  // Helper function to check if we should stop polling
  const shouldStopPolling = (imports: ImportProgress[]): boolean => {
    // Stop polling when ALL imports are in final states (Completed, Failed, Cancelled)
    const finalStates = ['Completed', 'Failed', 'Cancelled'];
    const allInFinalState = imports.length > 0 && imports.every(imp => 
      finalStates.includes(getStatusString(imp.status))
    );
    
    console.log('🔍 shouldStopPolling check:', {
      totalImports: imports.length,
      allInFinalState,
      importStatuses: imports.map(imp => ({
        id: imp.id,
        status: getStatusString(imp.status)
      })),
      shouldStop: allInFinalState
    });
    
    return allInFinalState;
  };

  // Helper function to check for stuck imports (in Finalizing status for too long)
  const checkForStuckImports = (imports: ImportProgress[]): void => {
    const now = new Date();
    const stuckThreshold = 5 * 60 * 1000; // 5 minutes
    
    imports.forEach(imp => {
      if (getStatusString(imp.status) === 'Finalizing') {
        const finalizingTime = new Date(imp.updated_at);
        const timeSinceUpdate = now.getTime() - finalizingTime.getTime();
        
        if (timeSinceUpdate > stuckThreshold) {
          console.warn(`Import ${imp.id} has been stuck in Finalizing status for ${Math.round(timeSinceUpdate / 1000)}s`);
          // We could potentially mark it as completed or show a warning to the user
        }
      }
    });
  };

  
  // Update the refs when the callbacks change
  useEffect(() => {
    onImportCompleteRef.current = onImportComplete;
    onImportCancelledRef.current = onImportCancelled;
  }, [onImportComplete, onImportCancelled]);

  // Track component mount/unmount
  useEffect(() => {
    console.log('🔄 ImportProgressViewer component mounted');
    return () => {
      console.log('🔄 ImportProgressViewer component unmounting');
    };
  }, []);

  // Poll for updates every 2 seconds, but only if there are active imports
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (pollIntervalRef.current) {
        console.log('🔄 startPolling() called - already polling, skipping');
        return; // Already polling
      }
      
      console.log('🔄 startPolling() called - starting new interval');
      pollIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetchImportProgress();
          const previousImportIds = new Set(importsRef.current.map(imp => imp.id));
          const newImports = response.imports.filter(imp => !previousImportIds.has(imp.id));
          
          setImports(response.imports);
          importsRef.current = response.imports; // Update ref immediately
          
          // Only fetch book metadata for truly new imports
          if (newImports.length > 0) {
            await fetchBookMetadataForNewImports(newImports, bookMetadata, fetchingMetadata, setBookMetadata, setFetchingMetadata);
          }
          
          // Check for stuck imports
          checkForStuckImports(response.imports);
          
          // Check for imports that are ready for upload (EpubGenerated status)
          const readyForUploadImports = response.imports.filter(imp => {
            const statusStr = getStatusString(imp.status);
            return statusStr === 'EpubGenerated';
          });
          
          // Handle ready imports by calling the upload helper
          for (const imp of readyForUploadImports) {
            console.log(`Import ${imp.id} is ready for upload, calling helper function`);
            
            // Call the helper function asynchronously
            // The helper will handle duplicate detection via 404 response
            handleCompletedImport(imp.id, imp.url).then(success => {
              if (success) {
                console.log(`Successfully processed import ${imp.id}`);
              } else {
                console.log(`Failed to process import ${imp.id}`);
              }
            });
          }
          
          // Check if any imports reached final state and trigger callback
          // Only trigger callback for imports that reached final state very recently (within last 2 minutes)
          const now = new Date();
          const finalStates = ['Completed', 'Failed', 'Cancelled'];
          const recentlyFinalizedImports = response.imports.filter(imp => {
            const statusStr = getStatusString(imp.status);
            if (!finalStates.includes(statusStr) || completedImports.has(imp.id)) {
              return false;
            }
            
            // Check if the import reached final state within the last 2 minutes
            const finalizedTime = new Date(imp.updated_at);
            const timeSinceFinalization = now.getTime() - finalizedTime.getTime();
            return timeSinceFinalization < 2 * 60 * 1000; // 2 minutes
          });
          if (recentlyFinalizedImports.length > 0 && onImportCompleteRef.current) {
            onImportCompleteRef.current();
            
            // Toast notifications disabled for Syosetu imports
            // recentlyCompletedImports.forEach(imp => {
            //   if (!toastShown.has(imp.id)) {
            //     // Extract title from URL or use a generic message
            //     const urlParts = imp.url.split('/');
            //     const novelId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
            //     toast.success(`Webnovel ${novelId} has been successfully imported to your library!`);
            //     
            //     // Mark toast as shown for this import
            //     setToastShown(prev => new Set(prev).add(imp.id));
            //   }
            // });
            
            // Mark these imports as completed to avoid duplicate callbacks
            setCompletedImports(prev => {
              const newSet = new Set(prev);
              recentlyFinalizedImports.forEach(imp => newSet.add(imp.id));
              return newSet;
            });
          }
          
          // Stop polling if no active imports
          const shouldStop = shouldStopPolling(response.imports);
          if (shouldStop) {
            console.log('Stopping polling - no active imports found');
            stopPolling();
            // Notify parent that polling is complete
            if (onPollingComplete) {
              onPollingComplete();
            }
          } else {
            console.log('Continuing polling - active imports:', response.imports.map(imp => ({
              id: imp.id,
              status: getStatusString(imp.status)
            })));
          }
        } catch (error) {
          // Don't log every polling error to reduce console spam
          // Only log if it's a significant error (not network timeout)
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('ImportProgressViewer: Failed to fetch import progress during polling:', error);
          }
        }
      }, 3000);
    };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      console.log('🛑 stopPolling() called - clearing interval');
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    } else {
      console.log('🛑 stopPolling() called - but no interval to clear');
    }
  };

    // Initial fetch with retry
    const initializeProgress = async (retryCount = 0) => {
      try {
        const response = await fetchImportProgress();
        setImports(response.imports);
        importsRef.current = response.imports; // Update ref immediately
        
        // Fetch book metadata for initial imports (all are new on first load)
        if (response.imports.length > 0) {
          await fetchBookMetadataForNewImports(response.imports, bookMetadata, fetchingMetadata, setBookMetadata, setFetchingMetadata);
        }
        
        // Start polling if there are active imports
        const activeImports = response.imports.filter(imp => 
          ['Starting', 'Downloading', 'EpubGenerated', 'Processing', 'Uploading', 'Finalizing'].includes(getStatusString(imp.status))
        );
        if (activeImports.length > 0) {
          startPolling();
        }
      } catch (error) {
        console.error(`ImportProgressViewer: Failed to fetch initial import progress (attempt ${retryCount + 1}):`, error);
        
        // Retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            initializeProgress(retryCount + 1);
          }, delay);
        } else {
          console.error('ImportProgressViewer: Max retries reached, giving up on initial fetch');
        }
      }
    };

    initializeProgress();

    return () => stopPolling();
  }, []); // Empty dependency array - only run once on mount

  // Watch for triggerPolling prop to start polling when a new import begins
  useEffect(() => {
    if (triggerPolling) {
      // Start polling immediately when triggered
      pollIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetchImportProgress();
          const previousImportIds = new Set(importsRef.current.map(imp => imp.id));
          const newImports = response.imports.filter(imp => !previousImportIds.has(imp.id));
          
          setImports(response.imports);
          importsRef.current = response.imports; // Update ref immediately
          
          // Only fetch book metadata for truly new imports
          if (newImports.length > 0) {
            await fetchBookMetadataForNewImports(newImports, bookMetadata, fetchingMetadata, setBookMetadata, setFetchingMetadata);
          }
          
          // Check for stuck imports
          checkForStuckImports(response.imports);
          
          // Check for imports that are ready for upload (EpubGenerated status)
          const readyForUploadImports = response.imports.filter(imp => {
            const statusStr = getStatusString(imp.status);
            return statusStr === 'EpubGenerated';
          });
          
          // Handle ready imports by calling the upload helper
          for (const imp of readyForUploadImports) {
            console.log(`Import ${imp.id} is ready for upload, calling helper function`);
            
            // Call the helper function asynchronously
            // The helper will handle duplicate detection via 404 response
            handleCompletedImport(imp.id, imp.url).then(success => {
              if (success) {
                console.log(`Successfully processed import ${imp.id}`);
              } else {
                console.log(`Failed to process import ${imp.id}`);
              }
            });
          }
          
          // Check if any imports reached final state and trigger callback
          // Only trigger callback for imports that reached final state very recently (within last 2 minutes)
          const now = new Date();
          const finalStates = ['Completed', 'Failed', 'Cancelled'];
          const recentlyFinalizedImports = response.imports.filter(imp => {
            const statusStr = getStatusString(imp.status);
            if (!finalStates.includes(statusStr) || completedImports.has(imp.id)) {
              return false;
            }
            
            // Check if the import reached final state within the last 2 minutes
            const finalizedTime = new Date(imp.updated_at);
            const timeSinceFinalization = now.getTime() - finalizedTime.getTime();
            return timeSinceFinalization < 2 * 60 * 1000; // 2 minutes
          });
          if (recentlyFinalizedImports.length > 0 && onImportCompleteRef.current) {
            onImportCompleteRef.current();
            
            // Toast notifications disabled for Syosetu imports
            // recentlyCompletedImports.forEach(imp => {
            //   if (!toastShown.has(imp.id)) {
            //     // Extract title from URL or use a generic message
            //     const urlParts = imp.url.split('/');
            //     const novelId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
            //     toast.success(`Webnovel ${novelId} has been successfully imported to your library!`);
            //     
            //     // Mark toast as shown for this import
            //     setToastShown(prev => new Set(prev).add(imp.id));
            //   }
            // });
            
            // Mark these imports as completed to avoid duplicate callbacks
            setCompletedImports(prev => {
              const newSet = new Set(prev);
              recentlyFinalizedImports.forEach(imp => newSet.add(imp.id));
              return newSet;
            });
          }
          
          // Stop polling if no active imports
          const shouldStop = shouldStopPolling(response.imports);
          if (shouldStop) {
            console.log('Stopping triggered polling - no active imports found');
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            // Notify parent that polling is complete
            if (onPollingComplete) {
              onPollingComplete();
            }
          } else {
            console.log('Continuing triggered polling - active imports:', response.imports.map(imp => ({
              id: imp.id,
              status: getStatusString(imp.status)
            })));
          }
        } catch (error) {
          console.error('ImportProgressViewer: Failed to fetch import progress during triggered polling:', error);
          // Don't stop polling on error, just log it and continue
        }
      }, 3000);

    return () => {
      console.log('🧹 ImportProgressViewer useEffect cleanup - clearing interval');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
    }
  }, [triggerPolling]); // Removed onImportComplete from dependencies

  // Auto-scroll to bottom when new logs arrive, but only if user is near the bottom
  useEffect(() => {
    if (logEndRef.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold
        
        if (isNearBottom) {
          // Scroll within the container instead of using scrollIntoView which affects the page
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  }, [imports]);

  const toggleExpanded = (importId: string) => {
    const newExpanded = new Set(expandedImports);
    const wasExpanded = newExpanded.has(importId);
    
    if (wasExpanded) {
      newExpanded.delete(importId);
    } else {
      newExpanded.add(importId);
    }
    setExpandedImports(newExpanded);
    
    // If we're expanding, scroll to bottom after a brief delay to allow DOM update
    if (!wasExpanded) {
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      }, 100);
    }
  };

  const handleCancel = async (importId: string) => {
    setCancelling(prev => new Set(prev).add(importId));
    try {
      await cancelImport(importId);
      toast.success('Import cancelled successfully');
      
      // Immediately update the local state to show cancelled status
      setImports(prev => {
        const updatedImports = prev.map(imp => 
          imp.id === importId 
            ? { ...imp, status: 'Cancelled' as const }
            : imp
        );
        
        // Check if we should stop polling after this update
        if (shouldStopPolling(updatedImports)) {
          // Stop polling by clearing the interval
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
        
        return updatedImports;
      });
      
      // Notify parent that an import was cancelled
      if (onImportCancelledRef.current) {
        onImportCancelledRef.current();
      }
    } catch (error) {
      console.error('Failed to cancel import:', error);
      toast.error('Failed to cancel import');
    } finally {
      setCancelling(prev => {
        const newSet = new Set(prev);
        newSet.delete(importId);
        return newSet;
      });
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const result = await clearCompletedImports();
      toast.success(`Cleared ${result.removed_count} imports`);
      
      // Refresh the imports list
      const response = await fetchImportProgress();
      setImports(response.imports);
    } catch (error) {
      console.error('Failed to clear completed imports:', error);
      toast.error('Failed to clear completed imports');
    } finally {
      setClearing(false);
    }
  };

  const getStatusIcon = (status: ImportProgress['status']) => {
    const statusStr = getStatusString(status);
    switch (statusStr) {
      case 'Starting':
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'Downloading':
      case 'Processing':
        return <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />;
      case 'EpubGenerated':
        return <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Unpacking':
        return <Loader2 className="h-4 w-4 text-orange-600 dark:text-orange-400 animate-spin" />;
      case 'Uploading':
        return <Upload className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-pulse" />;
      case 'Finalizing':
        return <Settings className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-spin" />;
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'Failed':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'Cancelled':
        return <X className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ImportProgress['status']) => {
    const statusStr = getStatusString(status);
    switch (statusStr) {
      case 'Starting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30';
      case 'Downloading':
      case 'Processing':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600';
      case 'EpubGenerated':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/30';
      case 'Unpacking':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/30';
      case 'Uploading':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/30';
      case 'Finalizing':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/30';
      case 'Completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30';
      case 'Failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/30';
      case 'Cancelled':
        return 'bg-muted text-muted-foreground hover:bg-muted/80';
      default:
        return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  const formatDuration = (startedAt: string, status: ImportProgress['status'], updatedAt?: string) => {
    const start = new Date(startedAt);
    const statusStr = getStatusString(status);
    
    // For completed/cancelled imports, use the updated_at time to show final duration
    let endTime: Date;
    if (statusStr === 'Completed' || statusStr === 'Cancelled' || statusStr === 'Failed') {
      endTime = updatedAt ? new Date(updatedAt) : new Date();
    } else {
      endTime = new Date(); // Live timer for active imports
    }
    
    const diffMs = endTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  const getProgressPercentage = (importItem: ImportProgress): number => {
    const statusStr = getStatusString(importItem.status);
    switch (statusStr) {
      case 'Starting':
        return 10;
      case 'Downloading':
        // Use chapter progress if available
        if (importItem.total_chapters && importItem.current_chapter) {
          const chapterProgress = (importItem.current_chapter / importItem.total_chapters) * 100;
          // Map chapter progress (0-100%) to overall progress (10-30%)
          return 10 + Math.round((chapterProgress / 100) * 20);
        }
        return 20; // Default if no chapter info available
      case 'Processing':
        return 60;
      case 'Uploading':
        // Try to extract percentage from logs
        const uploadLog = importItem.logs.find(log => log.includes('Uploading files:') && log.includes('%'));
        if (uploadLog) {
          const match = uploadLog.match(/(\d+)%/);
          if (match) {
            const fileProgress = parseInt(match[1]);
            // Map file upload progress (0-100%) to overall progress (60-90%)
            return 60 + Math.round((fileProgress / 100) * 30);
          }
        }
        return 70;
      case 'Finalizing':
        return 95;
      case 'Completed':
        return 100;
      case 'Failed':
      case 'Cancelled':
        return 0;
      default:
        return 0;
    }
  };

  const formatLogLine = (log: string) => {
    // Color code different types of logs
    if (log.startsWith('[ERR]')) {
      return <span className="text-red-600 dark:text-red-400 font-mono text-sm">{log}</span>;
    } else if (log.startsWith('[OUT]')) {
      return <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{log}</span>;
    } else {
      return <span className="text-foreground font-mono text-sm">{log}</span>;
    }
  };


  // Show the component if there are imports OR if polling is triggered (even if initial fetch failed)
  if (imports.length === 0 && !triggerPolling) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5" />
            Import Progress
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing || imports.filter(imp => 
              getStatusString(imp.status) === 'Completed' || getStatusString(imp.status) === 'Cancelled'
            ).length === 0}
            className="self-start sm:self-auto"
          >
            {clearing ? 'Clearing...' : 'Clear'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {imports.length === 0 && triggerPolling ? (
          <div className="text-center py-8">
            <div className="text-sm text-muted-foreground">
              Starting import... Please wait while we fetch the latest progress.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
          {imports.map((importItem) => {
            const importId = importItem.id; // Use the actual import ID from backend
            const isExpanded = expandedImports.has(importId);
            const isCancelling = cancelling.has(importId);
            const canCancel = getStatusString(importItem.status) === 'Downloading';
            const displayInfo = formatDisplayTitle(importItem, bookMetadata, fetchingMetadata);

            return (
              <div key={importId} className="border rounded-lg p-3 sm:p-4 relative">
                {/* Cancel button in top-right corner */}
                {canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(importId)}
                    disabled={isCancelling}
                    className="absolute top-2 right-2 text-xs px-2 py-1 h-7 hidden sm:flex"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    <span className="ml-1">Cancel</span>
                  </Button>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {getStatusIcon(importItem.status)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm break-all sm:break-normal sm:truncate">
                          {displayInfo.isLoading ? (
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-4 w-32 sm:w-48" />
                              {displayInfo.ncode && (
                                <span className="text-muted-foreground">({displayInfo.ncode})</span>
                              )}
                            </div>
                          ) : (
                            <>
                              {displayInfo.title}
                              {displayInfo.ncode && (
                                <span className="text-muted-foreground ml-1">({displayInfo.ncode})</span>
                              )}
                            </>
                          )}
                        </div>
                        <a
                          href={displayInfo.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View on Narou"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-1">
                        <Badge className={getStatusColor(importItem.status)}>
                          {getStatusString(importItem.status)}
                        </Badge>
                        <span className="whitespace-nowrap">{formatDuration(importItem.started_at, importItem.status, importItem.updated_at)}</span>
                      </div>
                      {/* Progress bar for active imports */}
                      {['Starting', 'Downloading', 'EpubGenerated', 'Processing', 'Unpacking', 'Uploading', 'Finalizing'].includes(getStatusString(importItem.status)) && (
                        <div className="mt-2 w-full">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{getProgressPercentage(importItem)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${getProgressPercentage(importItem)}%` }}
                            />
                          </div>
                          {/* Warning message for active imports */}
                          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-accent-foreground bg-accent px-3 py-2 rounded-md border border-border">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            <span className="text-center">⚠️ Do not close this tab while importing</span>
                          </div>
                          {/* View logs button */}
                          <div className="mt-2 flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(importId)}
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Hide logs
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  View logs
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Mobile cancel button */}
                {canCancel && (
                  <div className="flex justify-end mt-3 sm:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(importId)}
                      disabled={isCancelling}
                      className="text-xs px-2 py-1 h-7"
                    >
                      {isCancelling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      <span className="ml-1">Cancel</span>
                    </Button>
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">Live Logs:</div>
                    <ScrollArea 
                      ref={scrollAreaRef}
                      className="h-48 sm:h-64 w-full border rounded-md bg-muted/50 p-2 sm:p-3"
                    >
                      <div className="space-y-1">
                        {importItem.logs.map((log, logIndex) => (
                          <div key={logIndex} className="whitespace-pre-wrap break-words text-xs sm:text-sm">
                            {formatLogLine(log)}
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
