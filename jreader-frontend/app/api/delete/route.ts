import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

export async function DELETE(request: Request) {
  try {
    const { uploadId } = await request.json();
    
    if (!uploadId) {
      return NextResponse.json(
        { error: 'No upload ID provided' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if it's a webnovel (exists in user_webnovel table)
    const { data: userWebnovel, error: webnovelCheckError } = await supabase
      .from('user_webnovel')
      .select('webnovel_id')
      .eq('user_id', user.id)
      .eq('webnovel_id', uploadId)
      .single();

    if (webnovelCheckError && webnovelCheckError.code !== 'PGRST116') {
      console.error('Error checking webnovel:', webnovelCheckError);
      return NextResponse.json(
        { error: 'Failed to check book type' },
        { status: 500 }
      );
    }

    const isWebnovel = !!userWebnovel;

    if (isWebnovel) {
      // Handle webnovel deletion - only remove user relationship
      console.log('Deleting webnovel relationship for user:', user.id, 'webnovel:', uploadId);
      
      const { error: deleteWebnovelError } = await supabase
        .from('user_webnovel')
        .delete()
        .eq('user_id', user.id)
        .eq('webnovel_id', uploadId);

      if (deleteWebnovelError) {
        console.error('Error deleting webnovel relationship:', deleteWebnovelError);
        return NextResponse.json(
          { error: 'Failed to remove webnovel from library' },
          { status: 500 }
        );
      }

      console.log('Successfully removed webnovel from user library');
      return NextResponse.json({
        success: true,
        message: 'Webnovel removed from your library',
        type: 'webnovel'
      });
    }

    // Handle regular book deletion - check if it belongs to the user
    const { data: bookData, error: bookError } = await supabase
      .from('User Uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (bookError || !bookData) {
      console.error('Book not found:', bookError);
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Delete all files from Supabase Storage
    const bookBasePath = `${user.id}/${uploadId}`;
    
    console.log('Attempting to delete book at path:', bookBasePath);
    
    // Function to recursively list all files in a directory
    const listAllFiles = async (path: string): Promise<string[]> => {
      console.log('Listing files in path:', path);
      
      const { data: fileList, error: listError } = await supabase.storage
        .from('uploads')
        .list(path, {
          limit: 1000,
          offset: 0
        });

      if (listError) {
        console.error(`Error listing files in ${path}:`, listError);
        return [];
      }

      console.log('Found items in path:', path, fileList);

      if (!fileList || fileList.length === 0) {
        console.log('No files found in path:', path);
        return [];
      }

      const files: string[] = [];
      
      for (const item of fileList) {
        const fullPath = `${path}/${item.name}`;
        console.log('Processing item:', item.name, 'at path:', fullPath, 'metadata:', item.metadata);
        
        if (item.metadata) {
          // This is a file
          console.log('Adding file to delete list:', fullPath);
          files.push(fullPath);
        } else {
          // This is a directory, recursively list its contents
          console.log('Found directory, recursing into:', fullPath);
          const subFiles = await listAllFiles(fullPath);
          files.push(...subFiles);
        }
      }
      
      return files;
    };

    // Get all files to delete
    const filesToDelete = await listAllFiles(bookBasePath);
    console.log('Total files to delete:', filesToDelete.length);
    console.log('Files to delete:', filesToDelete);

    // Delete all files in the book directory
    if (filesToDelete.length > 0) {
      console.log('Deleting files from storage...');
      const { error: deleteStorageError } = await supabase.storage
        .from('uploads')
        .remove(filesToDelete);

      if (deleteStorageError) {
        console.error('Error deleting files from storage:', deleteStorageError);
        return NextResponse.json(
          { error: 'Failed to delete files from storage' },
          { status: 500 }
        );
      }
      
      console.log('Successfully deleted', filesToDelete.length, 'files from storage');
    } else {
      console.log('No files found to delete');
    }

    // Delete table of contents entries
    console.log('Deleting table of contents for upload ID:', uploadId);
    const { data: deletedToc, error: tocDeleteError } = await supabase
      .from('Table of Contents')
      .delete()
      .eq('upload_id', uploadId)
      .select();

    if (tocDeleteError) {
      console.error('Error deleting table of contents:', tocDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete table of contents' },
        { status: 500 }
      );
    }
    
    console.log('Deleted TOC entries:', deletedToc);

    // Delete the book record from User Uploads table
    console.log('Attempting to delete book record with ID:', uploadId);
    
    // First, let's check if the record exists
    const { data: existingBook, error: checkError } = await supabase
      .from('User Uploads')
      .select('*')
      .eq('id', uploadId)
      .single();
    
    if (checkError) {
      console.error('Error checking if book exists:', checkError);
    } else {
      console.log('Found existing book record:', existingBook);
    }
    
    console.log('About to execute delete query for ID:', uploadId);
    
    const deleteResult = await supabase
      .from('User Uploads')
      .delete()
      .eq('id', uploadId)
      .select();

    console.log('Delete result:', deleteResult);
    console.log('Delete result data:', deleteResult.data);
    console.log('Delete result error:', deleteResult.error);
    console.log('Delete result count:', deleteResult.count);

    if (deleteResult.error) {
      console.error('Error deleting book record:', deleteResult.error);
      console.error('Error details:', {
        message: deleteResult.error.message,
        details: deleteResult.error.details,
        hint: deleteResult.error.hint
      });
      return NextResponse.json(
        { error: 'Failed to delete book record' },
        { status: 500 }
      );
    }

    if (!deleteResult.data || deleteResult.data.length === 0) {
      console.warn('Delete query succeeded but no rows were deleted');
      return NextResponse.json(
        { error: 'No rows were deleted - possible RLS policy issue' },
        { status: 500 }
      );
    }

    console.log('Successfully deleted book record:', deleteResult.data);

    return NextResponse.json({
      success: true,
      message: 'Book deleted successfully',
      type: 'regular',
      data: {
        uploadId,
        deletedFiles: filesToDelete.length
      }
    });

  } catch (error) {
    console.error('Delete route error:', error);
    return NextResponse.json(
      { error: `Delete failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 