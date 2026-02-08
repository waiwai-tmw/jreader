'use client';

import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getBackendApiUrl } from "@/utils/api";
import { formatDisplayTitle, fetchBookMetadataForNewImports } from '@/utils/importDisplay';
import { getMetadata } from "@/utils/supabase/client";
import type { SyosetuApiResponse } from '@/utils/syosetuApi';

type DictionaryStats = {
  term_count: number;
  freq_count: number;
  pitch_count: number;
  kanji_count: number;
  total_count: number;
};

type ImportStatus = 
  | "Starting"
  | "Downloading" 
  | "Processing"
  | "Unpacking"
  | "Uploading"
  | "Finalizing"
  | "Completed"
  | "Failed"
  | "Cancelled";

type ImportProgress = {
  id: string;
  user_id: string;
  url: string;
  status: ImportStatus | { Failed: string };
  logs: string[];
  started_at: string;
  updated_at: string;
  process_id?: number;
  total_chapters?: number;
  current_chapter?: number;
};

export default function AdminPage() {
  const { user, isLoading, isAdminLoading } = useAuth();
  const router = useRouter();
  usePageTitle('Admin - JReader');
  const [csvData, setCsvData] = useState<string>('');
  const [dictStats, setDictStats] = useState<DictionaryStats | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [maxSizeMb, setMaxSizeMb] = useState<string>('');
  const [renderAnalyzerEnabled, setRenderAnalyzerEnabled] = useState<boolean>(false);
  const [imports, setImports] = useState<ImportProgress[]>([]);
  const [importsLoading, setImportsLoading] = useState<boolean>(false);
  const [showOnlyInProgress, setShowOnlyInProgress] = useState<boolean>(true);
  const [bookMetadata, setBookMetadata] = useState<Map<string, SyosetuApiResponse>>(new Map());
  const [fetchingMetadata, setFetchingMetadata] = useState<Set<string>>(new Set());

  // Check authentication and admin status
  useEffect(() => {
    console.log('🔍 Admin page: Checking auth...', { user, isLoading, isAdminLoading })
    if (!isLoading && !isAdminLoading) {
      if (!user) {
        console.log('❌ Admin page: No user - redirecting to login')
        // Not logged in - redirect to login
        router.push('/login');
        return;
      }
      
      console.log('👤 Admin page: User found, checking admin status...', { 
        userName: user.name, 
        isAdmin: user.isAdmin 
      })
      
      if (!user.isAdmin) {
        console.log('❌ Admin page: User is not admin - redirecting to home')
        // Logged in but not admin - redirect to home
        router.push('/');
        return;
      }
      
      console.log('✅ Admin page: User is admin - allowing access')
    }
  }, [user, isLoading, isAdminLoading, router]);

  // Load render analyzer setting - defaults to false
  useEffect(() => {
    const saved = localStorage.getItem('renderAnalyzerEnabled');
    setRenderAnalyzerEnabled(saved === 'true');
  }, []);

  // Save render analyzer setting
  const handleRenderAnalyzerToggle = (enabled: boolean) => {
    setRenderAnalyzerEnabled(enabled);
    localStorage.setItem('renderAnalyzerEnabled', enabled.toString());
  };

  // Fetch all imports for admin
  const fetchImports = async () => {
    setImportsLoading(true);
    try {
      const metadata = await getMetadata();
      const apiUrl = `${getBackendApiUrl()}/api/import-progress/admin`;
      
      console.log('Fetching imports from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${metadata.accessToken}`
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to fetch imports: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Imports data received:', data);
      const newImports = data.imports || [];
      setImports(newImports);
      
      // Fetch metadata for new imports
      if (newImports.length > 0) {
        await fetchBookMetadataForNewImports(newImports, bookMetadata, fetchingMetadata, setBookMetadata, setFetchingMetadata);
      }
    } catch (error) {
      console.error('Error fetching imports:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Set empty array on error so the UI shows "No imports found" instead of crashing
      setImports([]);
    } finally {
      setImportsLoading(false);
    }
  };


  // Fetch imports when component mounts and user is admin
  useEffect(() => {
    if (user && user.isAdmin && !isLoading && !isAdminLoading) {
      fetchImports();
    }
  }, [user, isLoading, isAdminLoading]);

  // Show loading while checking auth or admin status
  if (isLoading || isAdminLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!user || !user.isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Redirecting...</div>
        </div>
      </div>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const metadata = await getMetadata();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      try {
        const response = await fetch(`${getBackendApiUrl()}/api/upload-dict`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metadata.accessToken}`
          },
          body: formData
        });
        const data = await response.json();
        setUploadStatus(data.message);
      } catch (error) {
        console.error('Error uploading dictionary:', error);
        setUploadStatus('Error uploading dictionary');
      }
    }
  };

  const parseCSVRow = (row: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') { // Handle escaped quotes
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    
    fields.push(field.trim()); // Push the last field
    return fields;
  };

  const handlePrintDicts = async () => {
    const metadata = await getMetadata();
    try {
      const response = await fetch(`${getBackendApiUrl()}/api/print-dicts`, {
        headers: {
          'Authorization': `Bearer ${metadata.accessToken}`
        }
      });
      const data = await response.json();
      setCsvData(data.csv);

      // Parse CSV and count dictionary types
      const rows = data.csv
        .trim()
        .split('\n')
        .slice(1)  // Skip header row
        .filter((row: string) => row.trim());

      const stats: DictionaryStats = {
        term_count: 0,
        freq_count: 0,
        pitch_count: 0,
        kanji_count: 0,
        total_count: 0
      };

      rows.forEach((row: string) => {
        const columns = parseCSVRow(row);
        const type = columns[2].replace(/["\s]/g, ''); // Remove quotes and whitespace
        
        switch (type) {
          case '0':
            stats.term_count++;
            break;
          case '1':
            stats.pitch_count++;
            break;
          case '2':
            stats.freq_count++;
            break;
          case '3':
            stats.kanji_count++;
            break;
        }
      });

      stats.total_count = stats.term_count + stats.freq_count + stats.pitch_count + stats.kanji_count;
      setDictStats(stats);
    } catch (error) {
      console.error('Error fetching dictionaries:', error);
    }
  };

  const handleScanDicts = async () => {
    const metadata = await getMetadata();
    setScanStatus('Scanning dictionaries...');
    try {
      const queryParams = new URLSearchParams();
      if (maxSizeMb) {
        queryParams.append('max_size_mb', maxSizeMb);
      }

      const response = await fetch(
        `${getBackendApiUrl()}/api/scan-dicts${queryParams.toString() ? '?' + queryParams.toString() : ''}`, 
        {
          headers: {
            'Authorization': `Bearer ${metadata.accessToken}`
          }
        }
      );
      const data = await response.json();
      if (data.error) {
        setScanStatus(`Error: ${data.error}`);
      } else {
        const dictCount = data.info?.length ?? 0;
        setScanStatus(`Scan complete: Found ${dictCount} dictionaries`);
        await handlePrintDicts();
      }
    } catch (error) {
      console.error('Error scanning dictionaries:', error);
      setScanStatus('Error scanning dictionaries');
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(csvData);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Helper functions for import status
  const getImportStatusInfo = (status: ImportStatus | { Failed: string }) => {
    if (typeof status === 'object' && 'Failed' in status) {
      return { status: 'Failed', message: status.Failed, variant: 'destructive' as const, icon: XCircle };
    }
    
    switch (status) {
      case 'Starting':
      case 'Downloading':
      case 'Processing':
      case 'Unpacking':
      case 'Uploading':
      case 'Finalizing':
        return { status, message: status, variant: 'default' as const, icon: Clock };
      case 'Completed':
        return { status, message: 'Completed', variant: 'default' as const, icon: CheckCircle };
      case 'Cancelled':
        return { status, message: 'Cancelled', variant: 'secondary' as const, icon: AlertCircle };
      default:
        return { status, message: String(status), variant: 'outline' as const, icon: AlertCircle };
    }
  };

  const isImportInProgress = (status: ImportStatus | { Failed: string }) => {
    if (typeof status === 'object' && 'Failed' in status) return false;
    return ['Starting', 'Downloading', 'EpubGenerated', 'Processing', 'Unpacking', 'Uploading', 'Finalizing'].includes(status);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getProgressPercentage = (importItem: ImportProgress) => {
    if (importItem.total_chapters && importItem.current_chapter) {
      return Math.round((importItem.current_chapter / importItem.total_chapters) * 100);
    }
    return null;
  };


  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-shrink-0 p-4 sm:p-6 border-b">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="space-y-6">
      
          {/* Import Status Section */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Import Status
              </CardTitle>
              <CardDescription>
                Monitor all imports across all users to check if it's safe to redeploy
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="showOnlyInProgress"
                  checked={showOnlyInProgress}
                  onCheckedChange={setShowOnlyInProgress}
                />
                <Label htmlFor="showOnlyInProgress" className="text-sm">
                  In Progress Only
                </Label>
              </div>
              <Button 
                onClick={fetchImports} 
                variant="outline" 
                size="sm"
                disabled={importsLoading}
                className="self-start sm:self-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${importsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {importsLoading ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Loading imports...</div>
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">No imports found</div>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const filteredImports = imports.filter(importItem => !showOnlyInProgress || isImportInProgress(importItem.status));
                const inProgressCount = imports.filter(importItem => isImportInProgress(importItem.status)).length;
                
                return (
                  <>
                    {filteredImports.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="text-sm text-muted-foreground">
                          {showOnlyInProgress 
                            ? `No in-progress imports found (${imports.length} total imports)`
                            : 'No imports found'
                          }
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-muted-foreground mb-2">
                          Showing {filteredImports.length} of {imports.length} imports
                          {showOnlyInProgress && inProgressCount > 0 && ` (${inProgressCount} in progress)`}
                        </div>
                        {filteredImports.map((importItem) => {
                const statusInfo = getImportStatusInfo(importItem.status);
                const inProgress = isImportInProgress(importItem.status);
                const progressPercentage = getProgressPercentage(importItem);
                const StatusIcon = statusInfo.icon;
                const displayInfo = formatDisplayTitle(importItem, bookMetadata, fetchingMetadata);
                
                return (
                  <div 
                    key={importItem.id} 
                    className={`p-3 sm:p-4 border rounded-lg ${
                      inProgress 
                        ? 'border-warning bg-warning/10' 
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-4 w-4" />
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.message}
                          </Badge>
                          {inProgress && (
                            <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
                              In Progress
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <div className="font-medium break-words min-w-0 flex-1">
                              {displayInfo.title}
                              {displayInfo.ncode && (
                                <span className="text-muted-foreground ml-1">({displayInfo.ncode})</span>
                              )}
                            </div>
                            <a
                              href={displayInfo.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 self-start sm:self-auto"
                              title="View on Narou"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div className="text-muted-foreground">
                            User: {importItem.user_id}
                          </div>
                          <div className="text-muted-foreground">
                            Started: {formatDateTime(importItem.started_at)}
                          </div>
                          {importItem.updated_at !== importItem.started_at && (
                            <div className="text-muted-foreground">
                              Updated: {formatDateTime(importItem.updated_at)}
                            </div>
                          )}
                          {progressPercentage !== null && (
                            <div className="text-muted-foreground">
                              Progress: {importItem.current_chapter}/{importItem.total_chapters} chapters ({progressPercentage}%)
                            </div>
                          )}
                          {importItem.process_id && (
                            <div className="text-muted-foreground">
                              Process ID: {importItem.process_id}
                            </div>
                          )}
                        </div>
                        
                        {importItem.logs.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View recent logs ({importItem.logs.length} total)
                            </summary>
                            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono max-h-40 overflow-y-auto overflow-x-auto">
                              {importItem.logs.slice(-10).map((log, index) => (
                                <div key={index} className="mb-1 break-words whitespace-pre-wrap min-w-0">{log}</div>
                              ))}
                              {importItem.logs.length > 10 && (
                                <div className="text-muted-foreground mt-2 border-t pt-1">
                                  ... showing last 10 of {importItem.logs.length} logs
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                );
                        })}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
          </Card>
          
          <div className="space-y-4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="dictUpload"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            multiple
          />
          <label
            htmlFor="dictUpload"
            className="cursor-pointer text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Click to upload
          </label>
          <span className="text-muted-foreground"> or drag dictionary files here</span>
        </div>

        {uploadStatus && (
          <p className="text-sm text-muted-foreground">{uploadStatus}</p>
        )}

        <div className="h-4" /> {/* Spacer */}

        <div className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="maxSize">Max Dictionary Size (MB)</Label>
            <Input
              type="number"
              id="maxSize"
              placeholder="Leave empty for no limit"
              value={maxSizeMb}
              onChange={(e) => setMaxSizeMb(e.target.value)}
              className="max-w-[200px]"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handlePrintDicts}
              variant="outline"
            >
              Print Dictionaries
            </Button>
            <Button 
              onClick={handleScanDicts}
              variant="outline"
            >
              Scan Dictionaries
            </Button>
          </div>

          {scanStatus && (
            <p className="text-sm text-muted-foreground">{scanStatus}</p>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold">Development Tools</h3>
            <div className="flex items-center space-x-2">
              <Switch
                id="renderAnalyzer"
                checked={renderAnalyzerEnabled}
                onCheckedChange={handleRenderAnalyzerToggle}
              />
              <Label htmlFor="renderAnalyzer" className="text-sm">
                Enable Render Analyzer (Ctrl+Shift+R to toggle)
              </Label>
            </div>
          </div>
          
          {dictStats && (
            <div className="mt-4 p-4 border rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">Dictionary Statistics</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                <div className="text-sm">
                  <span className="text-muted-foreground">Terms:</span>{' '}
                  <span className="font-medium">{dictStats.term_count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Frequency:</span>{' '}
                  <span className="font-medium">{dictStats.freq_count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Pitch:</span>{' '}
                  <span className="font-medium">{dictStats.pitch_count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Kanji:</span>{' '}
                  <span className="font-medium">{dictStats.kanji_count}</span>
                </div>
                <div className="text-sm font-semibold">
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span>{dictStats.total_count}</span>
                </div>
              </div>
            </div>
          )}
          
          {csvData && (
            <div className="space-y-2">
              <Textarea 
                value={csvData}
                readOnly
                className="min-h-[200px] font-mono"
              />
              <Button 
                onClick={handleCopyToClipboard}
                variant="secondary"
                size="sm"
                disabled={isCopied}
              >
                {isCopied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
