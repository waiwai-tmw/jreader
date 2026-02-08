import JSZip from 'jszip';
import { NextResponse } from 'next/server';

import { getBackendApiUrl } from '@/utils/api';
import { encodeFilename } from '@/utils/filename';
import { createClient } from '@/utils/supabase/server';

// Helper function to update import progress with a provided auth token
async function updateImportProgressWithToken(importId: string, status: string, log: string | undefined, authToken: string): Promise<void> {
  const apiUrl = `${getBackendApiUrl()}/api/import-progress/${importId}/update`;

  console.log('Updating import progress with token:', {
    importId,
    status,
    log,
    apiUrl,
    hasToken: !!authToken
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status,
      log
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update import progress:', {
      status: response.status,
      statusText: response.statusText,
      errorText
    });
    throw new Error(`Failed to update import progress: ${response.statusText}`);
  }

  console.log('Successfully updated import progress');
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'css':
      return 'text/css';
    case 'html':
    case 'xhtml':
      return 'application/xhtml+xml';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function uploadIndividualFiles(
  supabase: any,
  contents: any,
  bucketName: string,
  basePath: string,
  logPrefix: string,
  onProgress?: (uploaded: number, total: number, percentage: number) => void
): Promise<{ uploadedCount: number; errorCount: number }> {
  console.log(`=== ${logPrefix} INDIVIDUAL FILES UPLOAD ===`);
  console.log(`Uploading to ${bucketName} bucket: ${basePath}`);

  let uploadedCount = 0;
  let errorCount = 0;
  const totalFiles = Object.keys(contents.files).filter(path => !(contents.files[path] as any).dir).length;
  let lastReportedPercentage = 0;

  for (const [path, zipEntry] of Object.entries(contents.files)) {
    // Skip directories
    if ((zipEntry as any).dir) continue;

    console.log(`Processing file: ${path}`);

    // Get the file content as an ArrayBuffer
    const content = await (zipEntry as any).async('arraybuffer');

    // Split path into directory and filename
    const pathParts = path.split('/');
    const filename = pathParts.pop()!;
    const encodedFilename = encodeFilename(filename);
    const encodedPath = [...pathParts, encodedFilename].join('/');

    console.log(`Uploading to ${bucketName}: ${basePath}/${encodedPath}`);

    // Upload the file with the correct content type
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(`${basePath}/${encodedPath}`, content, {
        contentType: getContentType(path),
        upsert: true
      });

    if (error) {
      console.error(`❌ Error uploading ${path} to ${bucketName} bucket:`, error);
      console.error(`   Upload path: ${basePath}/${encodedPath}`);
      console.error(`   Original path: ${path}`);
      errorCount++;
    } else {
      console.log(`Successfully uploaded to ${bucketName}: ${path} -> ${data.path}`);
      uploadedCount++;
    }

    // Calculate current percentage
    const currentPercentage = Math.floor(((uploadedCount + errorCount) / totalFiles) * 100);

    // Report progress in 10% increments
    if (onProgress && currentPercentage >= lastReportedPercentage + 10) {
      onProgress(uploadedCount + errorCount, totalFiles, currentPercentage);
      lastReportedPercentage = currentPercentage;
    }
  }

  // Always report final progress if we haven't reached 100%
  if (onProgress && lastReportedPercentage < 100) {
    onProgress(uploadedCount + errorCount, totalFiles, 100);
  }

  console.log(`${logPrefix} file upload summary: ${uploadedCount} successful, ${errorCount} failed`);

  if (errorCount > 0) {
    console.warn(`⚠️ ${errorCount} files failed to upload to ${bucketName} bucket`);
    console.warn(`This may cause issues when reading the book`);
  }

  return { uploadedCount, errorCount };
}

export async function POST(request: Request) {
  console.log('=== Next.js API Upload Route Started ===');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bookMetadataStr = formData.get('bookMetadata') as string;
    const originalUrl = formData.get('originalUrl') as string; // For webnovel imports
    const importId = formData.get('importId') as string; // For progress tracking
    const authToken = formData.get('authToken') as string; // For progress updates
    const epubFilename = formData.get('epubFilename') as string; // For server-side EPUB fetching

    // Clean the URL: strip whitespace and trailing slashes
    const cleanedUrl = originalUrl ? originalUrl.trim().replace(/\/+$/, '') : null;

    console.log('Form data received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      hasMetadata: !!bookMetadataStr,
      metadataLength: bookMetadataStr?.length,
      hasOriginalUrl: !!originalUrl,
      originalUrl: originalUrl,
      cleanedUrl: cleanedUrl,
      hasImportId: !!importId,
      importId: importId,
      hasAuthToken: !!authToken,
      hasEpubFilename: !!epubFilename,
      epubFilename: epubFilename
    });

    // Debug webnovel import detection
    if (cleanedUrl) {
      console.log('=== WEBNOVEL IMPORT DETECTED ===');
      console.log('Original URL:', originalUrl);
      console.log('Cleaned URL:', cleanedUrl);
      console.log('Will handle as webnovel import (skip uploads bucket, use user_webnovel table)');
    } else {
      console.log('=== REGULAR EPUB UPLOAD ===');
      console.log('No originalUrl found, will upload to uploads bucket and User Uploads table');
    }

    // For webnovel imports, we need either a file OR epubFilename + metadata
    // For regular uploads, we need a file + metadata
    if (cleanedUrl) {
      // Webnovel import: need epubFilename and metadata
      if (!epubFilename || !bookMetadataStr) {
        console.error('Missing epubFilename or metadata for webnovel import:', {
          hasEpubFilename: !!epubFilename,
          hasMetadata: !!bookMetadataStr
        });
        return NextResponse.json(
          { error: 'No EPUB filename or metadata provided for webnovel import' },
          { status: 400 }
        );
      }
    } else {
      // Regular upload: need file and metadata
      if (!file || !bookMetadataStr) {
        console.error('Missing file or metadata for regular upload:', {
          hasFile: !!file,
          hasMetadata: !!bookMetadataStr
        });
        return NextResponse.json(
          { error: 'No file or metadata provided' },
          { status: 400 }
        );
      }
    }

    const uploadResponse = {
      bookMetadata: JSON.parse(bookMetadataStr),
      filePath: cleanedUrl ? epubFilename.replace('.epub', '') : file.name.replace('.epub', '')
    };

    const supabase = await createClient();

    // Check if webnovel bucket exists (for webnovel imports)
    if (cleanedUrl) {
      try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          console.error('Error listing buckets:', bucketError);
        } else {
          const webnovelBucket = buckets?.find(bucket => bucket.name === 'webnovel');
          if (webnovelBucket) {
            console.log('Webnovel bucket found:', webnovelBucket);
          } else {
            console.error('Webnovel bucket not found! Available buckets:', buckets?.map(b => b.name));
          }
        }
      } catch (bucketCheckError) {
        console.error('Exception checking buckets:', bucketCheckError);
      }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's tier and enforce book limits
    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Get current book count
    const { count: bookCount, error: countError } = await supabase
      .from('User Uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting user books:', countError);
      return NextResponse.json(
        { error: 'Failed to count user books' },
        { status: 500 }
      );
    }

    // Determine book limit based on tier
    const getBookLimit = (tier: number) => {
      switch (tier) {
        case 0: // Free tier
          return 5;
        case 1: // Supporter tier
          return 25;
        default:
          return 5; // Default to free tier limit
      }
    };

    const bookLimit = getBookLimit(userData.tier);
    const currentCount = bookCount || 0;

    console.log('Book limit check:', {
      userTier: userData.tier,
      bookLimit,
      currentCount,
      canUpload: currentCount < bookLimit
    });

    // Check if user has reached their limit
    if (currentCount >= bookLimit) {
      const tier = userData.tier;
      let errorMessage = 'You have reached the maximum number of books for your current plan.';

      if (tier === 0) {
        errorMessage = 'You have reached the maximum number of books (5). Consider joining the Supporter tier for up to 25 books and more features!';
      }

      console.error('User reached book limit:', { tier, currentCount, bookLimit });
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }

    // Handle webnovel imports vs regular EPUB uploads differently
    if (cleanedUrl) {
      // WEBNOVEL IMPORT FLOW
      console.log('=== STARTING WEBNOVEL IMPORT FLOW ===');
      return await handleWebnovelImport(supabase, user, uploadResponse, cleanedUrl, importId, authToken, epubFilename);
    } else {
      // REGULAR EPUB UPLOAD FLOW
      console.log('=== STARTING REGULAR EPUB UPLOAD FLOW ===');

      // Validate EPUB file for regular uploads
      console.log('Processing EPUB file...');
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      console.log('Reading file as ArrayBuffer...');
      const bytes = await file.arrayBuffer();
      console.log('ArrayBuffer size:', bytes.byteLength);

      console.log('Loading ZIP contents...');
      const zip = new JSZip();
      const contents = await zip.loadAsync(bytes);
      console.log('ZIP loaded, file count:', Object.keys(contents.files).length);

      const containerXml = contents.file('META-INF/container.xml');
      if (!containerXml) {
        console.error('Invalid EPUB: missing META-INF/container.xml');
        return NextResponse.json(
          { error: 'Invalid EPUB file' },
          { status: 400 }
        );
      }
      console.log('EPUB validation passed');

      return await handleRegularUpload(supabase, user, file, uploadResponse, contents);
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

async function handleWebnovelImport(supabase: any, user: any, uploadResponse: any, originalUrl: string, importId?: string, authToken?: string, epubFilename?: string) {
  console.log('=== WEBNOVEL IMPORT HANDLER ===');
  console.log('📝 Next.js API route received webnovel import request:', {
    importId,
    originalUrl,
    epubFilename,
    hasAuthToken: !!authToken
  });

  // Helper function to update progress if importId and authToken are provided
  const updateProgress = async (status: string, log?: string) => {
    console.log('updateProgress called:', { importId, status, log, hasImportId: !!importId, hasAuthToken: !!authToken });
    if (importId && authToken) {
      try {
        await updateImportProgressWithToken(importId, status, log, authToken);
        console.log(`Progress updated: ${status}${log ? ` - ${log}` : ''}`);
      } catch (error) {
        console.error('Failed to update progress:', error);
        // Don't throw - progress tracking is not critical
      }
    } else {
      console.log('No importId or authToken provided, skipping progress update');
    }
  };



  // Check if webnovel already exists (but don't create database records yet)
  const { data: existingWebnovel, error: webnovelCheckError } = await supabase
    .from('webnovel')
    .select('id')
    .eq('url', originalUrl)
    .single();

  if (webnovelCheckError && webnovelCheckError.code !== 'PGRST116') {
    console.error('Error checking for existing webnovel:', webnovelCheckError);
    return NextResponse.json(
      { error: 'Failed to check for existing webnovel' },
      { status: 500 }
    );
  }

  let webnovelId: string;
  if (existingWebnovel) {
    // Use existing webnovel
    webnovelId = existingWebnovel.id;
    console.log('Using existing webnovel:', webnovelId);

    // Check if user already has this webnovel in their library
    const { data: existingUserWebnovel, error: userWebnovelCheckError } = await supabase
      .from('user_webnovel')
      .select('webnovel_id')
      .eq('user_id', user.id)
      .eq('webnovel_id', webnovelId)
      .single();

    if (userWebnovelCheckError && userWebnovelCheckError.code !== 'PGRST116') {
      console.error('Error checking existing user webnovel:', userWebnovelCheckError);
      return NextResponse.json(
        { error: 'Failed to check existing webnovel' },
        { status: 500 }
      );
    }

    if (existingUserWebnovel) {
      // User already has this webnovel, just return success
      console.log('User already has this webnovel in their library');
      return NextResponse.json({
        success: true,
        message: 'This webnovel is already in your library',
        webnovelId: webnovelId,
        bookMetadata: uploadResponse.bookMetadata,
        alreadyExists: true
      });
    }
  } else {
    // Generate ID for new webnovel (but don't insert yet)
    webnovelId = crypto.randomUUID();
    console.log('Generated new webnovel ID:', webnovelId);
  }


  // Fetch EPUB file from Rust backend
  console.log('=== FETCHING EPUB FROM RUST BACKEND ===');
  let epubFile: File;
  let epubBytes: ArrayBuffer;
  let contents: JSZip;

  try {
    if (!epubFilename || !authToken) {
      throw new Error('Missing epubFilename or authToken for EPUB fetch');
    }

    // Get the API URL using the existing utility function
    const downloadUrl = `${getBackendApiUrl()}/api/webnovel/download/${encodeURIComponent(epubFilename)}`;
    console.log('=== FETCHING EPUB FROM RUST BACKEND ===');
    console.log('Fetching EPUB from:', downloadUrl);

    const serviceAuthToken = process.env.NEXTJS_TO_RUST_SERVICE_AUTH_TOKEN;
    if (!serviceAuthToken) {
      console.error('Missing NEXTJS_TO_RUST_SERVICE_AUTH_TOKEN environment variable');
      throw new Error('Service authentication not configured');
    }

    const epubResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Service-Auth': serviceAuthToken
      }
    });

    if (!epubResponse.ok) {
      const errorText = await epubResponse.text();
      console.error('Failed to fetch EPUB from Rust backend:', {
        status: epubResponse.status,
        statusText: epubResponse.statusText,
        errorText
      });
      throw new Error(`Failed to fetch EPUB from Rust backend: ${epubResponse.statusText}`);
    }

    const epubBlob = await epubResponse.blob();
    epubFile = new File([epubBlob], epubFilename, { type: 'application/epub+zip' });
    console.log('Successfully fetched EPUB from Rust backend:', {
      name: epubFile.name,
      size: epubFile.size,
      type: epubFile.type
    });

    // Validate EPUB file
    console.log('=== EPUB VALIDATION ===');
    epubBytes = await epubFile.arrayBuffer();
    const zip = new JSZip();
    contents = await zip.loadAsync(epubBytes);

    const containerXml = contents.file('META-INF/container.xml');
    if (!containerXml) {
      console.error('Invalid EPUB: missing META-INF/container.xml');
      await updateProgress('Failed:Invalid EPUB', 'EPUB file is invalid');
      return NextResponse.json(
        { error: 'Invalid EPUB file' },
        { status: 400 }
      );
    }
    console.log('EPUB validation passed');
  } catch (error) {
    console.error('Error fetching EPUB from Rust backend:', error);
    await updateProgress('Failed:EPUB fetch failed', 'Failed to fetch EPUB file from backend');
    return NextResponse.json(
      { error: 'Failed to fetch EPUB file from backend' },
      { status: 500 }
    );
  }

  // Update progress to Uploading
  await updateProgress('Uploading', 'Starting file upload to storage...');

  // Upload EPUB file to webnovel bucket
  console.log('=== WEBNOVEL EPUB UPLOAD ===');
  try {
      // epubBytes already fetched during validation
      const uploadPath = `${webnovelId}.epub`;
      console.log(`Uploading EPUB to webnovel bucket: ${uploadPath}`);

      const { data: epubData, error: epubError } = await supabase.storage
        .from('webnovel')
        .upload(uploadPath, epubBytes, {
          contentType: 'application/epub+zip',
          upsert: true
        });

      if (epubError) {
        console.error('Error uploading EPUB to webnovel bucket:', epubError);
        return NextResponse.json(
          { error: 'Failed to upload EPUB to webnovel bucket' },
          { status: 500 }
        );
      }

      console.log(`Successfully uploaded EPUB to webnovel bucket: ${epubData.path}`);
      await updateProgress('Unpacking', 'EPUB file uploaded, now unpacking contents...');

      // Also upload individual files to webnovel bucket for reading
      try {
        console.log('Using already-loaded EPUB contents for individual file upload');
        // contents already loaded during validation
        await updateProgress('Uploading', 'EPUB unpacked, now uploading individual files...');

        // Get total file count for progress tracking
        const totalFiles = Object.keys(contents.files).filter(path => !(contents.files[path] as any).dir).length;
        await updateProgress('Uploading', `Starting upload of ${totalFiles} individual files...`);

        const uploadResult = await uploadIndividualFiles(
          supabase,
          contents,
          'webnovel',
          webnovelId,
          'WEBNOVEL',
          async (uploaded, total, percentage) => {
            await updateProgress('Uploading', `Uploading files: ${uploaded}/${total} (${percentage}%)`);
          }
        );

        console.log(`Individual files upload result: ${uploadResult.uploadedCount} uploaded, ${uploadResult.errorCount} errors`);

        if (uploadResult.errorCount > 0) {
          console.warn(`⚠️ Some files failed to upload to webnovel bucket. This may cause reading issues.`);
        }

        await updateProgress('Finalizing', `Uploaded ${uploadResult.uploadedCount} files successfully`);
      } catch (individualFilesError) {
        console.error('Exception during individual files upload:', individualFilesError);
        await updateProgress('Finalizing', 'Individual files upload completed with some errors');
        // Don't fail the entire import, just log the error
      }

  } catch (epubUploadError) {
    console.error('Exception during EPUB upload:', epubUploadError);
    await updateProgress('Failed:Upload failed', 'Failed to upload EPUB file');
    return NextResponse.json(
      { error: 'Failed to upload EPUB file' },
      { status: 500 }
    );
  }

  // Now that all files are uploaded, create the database records
  console.log('=== CREATING DATABASE RECORDS ===');

  // Fetch Syosetu metadata at import time to preserve accurate moji count
  console.log('=== FETCHING SYOSETU METADATA ===');
  let syosetuMetadata = null;
  try {
    const { fetchSyosetuMetadataFromUrl } = await import('@/utils/syosetuServer');
    syosetuMetadata = await fetchSyosetuMetadataFromUrl(originalUrl);

    if (syosetuMetadata) {
      console.log('Successfully fetched Syosetu metadata:', {
        title: syosetuMetadata.title,
        length: syosetuMetadata.length,
        genre: syosetuMetadata.genre,
        keyword: syosetuMetadata.keyword
      });
    } else {
      console.warn('Failed to fetch Syosetu metadata for URL:', originalUrl);
    }
  } catch (error) {
    console.error('Error fetching Syosetu metadata during import:', error);
    // Don't fail the import if metadata fetching fails
  }

  if (!existingWebnovel) {
    // Create new webnovel record
    console.log('Creating new webnovel with ID:', webnovelId);
    console.log('Webnovel metadata:', {
      title: uploadResponse.bookMetadata.title,
      author: uploadResponse.bookMetadata.author,
      total_pages: uploadResponse.bookMetadata.total_pages,
      spine: uploadResponse.bookMetadata.spine,
      spine_length: uploadResponse.bookMetadata.spine?.length,
      syosetu_metadata: syosetuMetadata ? 'present' : 'missing'
    });

    const { data: newWebnovel, error: webnovelError } = await supabase
      .from('webnovel')
      .insert({
        id: webnovelId,
        title: uploadResponse.bookMetadata.title,
        author: uploadResponse.bookMetadata.author,
        total_pages: uploadResponse.bookMetadata.total_pages,
        directory_name: uploadResponse.filePath,
        cover_path: uploadResponse.bookMetadata.cover_path || null,
        spine: uploadResponse.bookMetadata.spine,
        source: 'SYOSETU',
        url: originalUrl,
        syosetu_metadata: syosetuMetadata
      })
      .select('id')
      .single();

    if (webnovelError) {
      console.error('Failed to create webnovel record:', webnovelError);
      console.error('Webnovel insert data:', {
        id: webnovelId,
        title: uploadResponse.bookMetadata.title,
        author: uploadResponse.bookMetadata.author,
        total_pages: uploadResponse.bookMetadata.total_pages,
        directory_name: uploadResponse.filePath,
        cover_path: uploadResponse.bookMetadata.cover_path || null,
        spine: uploadResponse.bookMetadata.spine,
        source: 'SYOSETU',
        url: originalUrl
      });
      return NextResponse.json(
        { error: 'Failed to create webnovel record' },
        { status: 500 }
      );
    }

    console.log('Created new webnovel:', newWebnovel.id);
  } else {
    // Update existing webnovel with metadata if it doesn't have it
    if (syosetuMetadata) {
      console.log('Updating existing webnovel with Syosetu metadata:', webnovelId);
      const { error: updateError } = await supabase
        .from('webnovel')
        .update({ syosetu_metadata: syosetuMetadata })
        .eq('id', webnovelId)
        .is('syosetu_metadata', null);

      if (updateError) {
        console.error('Failed to update existing webnovel with metadata:', updateError);
        // Don't fail the import if metadata update fails
      } else {
        console.log('Successfully updated existing webnovel with metadata');
      }
    }
  }

  // Create user_webnovel relationship (for both new and existing webnovels)
  console.log('=== CREATING USER_WEBNOVEL RELATIONSHIP ===');
  const { data: userWebnovelData, error: userWebnovelError } = await supabase
    .from('user_webnovel')
    .upsert({
      user_id: user.id,
      webnovel_id: webnovelId,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,webnovel_id'
    });

  if (userWebnovelError) {
    console.error('Failed to create user_webnovel relationship:', userWebnovelError);
    return NextResponse.json(
      { error: 'Failed to associate webnovel with user' },
      { status: 500 }
    );
  }

  console.log('Successfully created user_webnovel relationship');

  // Insert table of contents entries for webnovel
  console.log('Inserting table of contents for webnovel...');
  console.log('TOC entries count:', uploadResponse.bookMetadata.toc.length);

  const { error: tocError } = await supabase
    .from('Table of Contents')
    .insert(
      uploadResponse.bookMetadata.toc.map((entry: any) => ({
        upload_id: webnovelId,
        page_number: entry.page_number,
        label: entry.label,
        content_path: entry.content_src,
        play_order: entry.play_order,
        book_type: 'WEBNOVEL'
      }))
    );

  if (tocError) {
    console.error('Failed to insert table of contents for webnovel:', tocError);
    return NextResponse.json(
      { error: 'Failed to save table of contents: ' + tocError?.message },
      { status: 500 }
    );
  }

  console.log('Successfully inserted table of contents for webnovel');

  // Update progress to completed
  console.log('=== UPDATING PROGRESS TO COMPLETED ===');
  await updateProgress('Completed', 'Webnovel import completed successfully');
  console.log('=== WEBNOVEL IMPORT COMPLETED ===');

  return NextResponse.json({
    success: true,
    message: 'Webnovel imported successfully',
    webnovelId: webnovelId,
    bookMetadata: uploadResponse.bookMetadata
  });
}

async function handleRegularUpload(supabase: any, user: any, file: File, uploadResponse: any, contents: any) {
  console.log('=== REGULAR UPLOAD HANDLER ===');

  try {
    // Create a base path for this book in storage
    // Generate a random UUID for the book
    const uploadId = crypto.randomUUID();
    const bookBasePath = `${user.id}/${uploadId}`;
    const uploadedFiles = [];

    console.log('Starting file upload to Supabase storage...');
    console.log('Upload details:', {
      uploadId,
      bookBasePath,
      totalFiles: Object.keys(contents.files).length
    });

    // Upload each file from the EPUB
    const { uploadedCount, errorCount } = await uploadIndividualFiles(
      supabase,
      contents,
      'uploads',
      bookBasePath,
      'REGULAR UPLOAD'
    );

    // Build uploadedFiles array for response
    for (const [path, zipEntry] of Object.entries(contents.files)) {
      if ((zipEntry as any).dir) continue;

      const pathParts = path.split('/');
      const filename = pathParts.pop()!;
      const encodedFilename = encodeFilename(filename);
      const encodedPath = [...pathParts, encodedFilename].join('/');

      uploadedFiles.push({
        originalPath: path,
        storagePath: `${bookBasePath}/${encodedPath}`,
        encodedPath: `${bookBasePath}/${encodedPath}`
      });
    }

    // After successful upload to both storage and Rust backend, insert into User Uploads table
    console.log('Inserting book metadata into database...');
    console.log('Book metadata:', {
      id: uploadId,
      title: uploadResponse.bookMetadata.title,
      author: uploadResponse.bookMetadata.author,
      total_pages: uploadResponse.bookMetadata.total_pages,
      directory_name: uploadResponse.filePath,
      cover_path: uploadResponse.bookMetadata.cover_path || null,
      spine_entries: uploadResponse.bookMetadata.spine?.length || 0
    });

    const { data: uploadData, error: insertError } = await supabase
        .from('User Uploads')
        .insert({
            id: uploadId,
            title: uploadResponse.bookMetadata.title,
            author: uploadResponse.bookMetadata.author,
            total_pages: uploadResponse.bookMetadata.total_pages,
            directory_name: uploadResponse.filePath,
            cover_path: uploadResponse.bookMetadata.cover_path || null,
            spine: uploadResponse.bookMetadata.spine
        })
        .select()
        .single();

    if (insertError || !uploadData) {
        console.error('Failed to insert book metadata:', insertError);
        return NextResponse.json(
            { error: 'Failed to insert book metadata: ' + insertError?.message },
            { status: 500 }
        );
    }

    console.log('Successfully inserted book metadata:', uploadData.id);

    // Insert table of contents entries
    console.log('Inserting table of contents...');
    console.log('TOC entries count:', uploadResponse.bookMetadata.toc.length);

    const { error: tocError } = await supabase
        .from('Table of Contents')
        .insert(
            uploadResponse.bookMetadata.toc.map((entry: any) => ({
                upload_id: uploadData.id,
                page_number: entry.page_number,
                label: entry.label,
                content_path: entry.content_src,
                play_order: entry.play_order,
                book_type: 'REGULAR'
            }))
        );

    if (tocError) {
        console.error('Failed to insert table of contents:', tocError);
        return NextResponse.json(
            { error: 'Failed to save table of contents: ' + tocError?.message },
            { status: 500 }
        );
    }

    console.log('Successfully inserted table of contents');

    console.log('=== Upload completed successfully ===');
    console.log('Final summary:', {
      filename: file.name,
      basePath: bookBasePath,
      uploadedFiles: uploadedFiles.length,
      bookMetadata: uploadResponse.bookMetadata.title
    });

    return NextResponse.json({
      message: 'Upload successful',
      data: {
        filename: file.name,
        basePath: bookBasePath,
        files: uploadedFiles,
        bookMetadata: uploadResponse.bookMetadata
      }
    });
  } catch (error) {
    console.error('Regular upload error:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
