import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadResult {
  url: string;
  path: string;
  error: Error | null;
}

interface SignedUrlResult {
  url: string;
  error: Error | null;
}

export function useStorageUpload(bucketName: string = 'report-photos') {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get a signed URL for viewing a file (private bucket)
  const getSignedUrl = useCallback(async (
    filePath: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<SignedUrlResult> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      return { url: data.signedUrl, error: null };
    } catch (error) {
      console.error('Signed URL error:', error);
      return { url: '', error: error as Error };
    }
  }, [bucketName]);

  // Extract file path from a storage URL (handles signed, public, and path-only formats)
  const extractPathFromUrl = useCallback((url: string): string | null => {
    if (!url) return null;
    
    // If it's already just a path (no http), return it directly
    if (!url.startsWith('http')) {
      return url.split('?')[0]; // Remove any query params
    }
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Handle different URL formats:
      // - Signed: /storage/v1/object/sign/bucket-name/path
      // - Public: /storage/v1/object/public/bucket-name/path
      // - Direct: /bucket-name/path
      const patterns = [
        `/storage/v1/object/sign/${bucketName}/`,
        `/storage/v1/object/public/${bucketName}/`,
        `/${bucketName}/`
      ];
      
      for (const pattern of patterns) {
        const idx = pathname.indexOf(pattern);
        if (idx !== -1) {
          return pathname.substring(idx + pattern.length);
        }
      }
      
      return null;
    } catch {
      // Fallback: try simple string extraction
      const simplePattern = `${bucketName}/`;
      const idx = url.indexOf(simplePattern);
      if (idx !== -1) {
        const pathWithQuery = url.substring(idx + simplePattern.length);
        return pathWithQuery.split('?')[0]; // Remove query string
      }
      return null;
    }
  }, [bucketName]);

  // Get signed URL from a stored value (path or URL with expired token)
  const getViewUrl = useCallback(async (
    storedUrl: string,
    expiresIn: number = 3600
  ): Promise<string> => {
    if (!storedUrl) return '';
    
    try {
      // If it's just a path (not a URL), use it directly for signed URL
      if (!storedUrl.startsWith('http')) {
        const result = await getSignedUrl(storedUrl, expiresIn);
        return result.url || storedUrl;
      }
      
      // Check if it's a public URL (not from our storage)
      if (!storedUrl.includes('supabase') && !storedUrl.includes('/storage/')) {
        return storedUrl;
      }
      
      // Extract path from the URL (removes expired tokens)
      const path = extractPathFromUrl(storedUrl);
      if (!path) {
        console.warn('Could not extract path from URL, using original:', storedUrl);
        return storedUrl;
      }
      
      const result = await getSignedUrl(path, expiresIn);
      return result.url || storedUrl;
    } catch (error) {
      console.error('Error in getViewUrl:', error);
      return storedUrl; // Fallback to original URL
    }
  }, [extractPathFromUrl, getSignedUrl]);

  const uploadFile = useCallback(async (
    file: File | Blob,
    folder?: string
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const extension = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const fileName = folder 
        ? `${folder}/${timestamp}-${randomId}.${extension}`
        : `${timestamp}-${randomId}.${extension}`;

      console.log('[useStorageUpload] Uploading to bucket:', bucketName, 'path:', fileName);
      setUploadProgress(30);

      // Upload to storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('[useStorageUpload] Upload error:', error);
        throw error;
      }

      setUploadProgress(100);

      // Build full public URL for public buckets
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${data.path}`;
      
      console.log('[useStorageUpload] Upload success, public URL:', publicUrl);

      return { 
        url: publicUrl,
        path: data.path,
        error: null 
      };
    } catch (error) {
      console.error('[useStorageUpload] Upload error:', error);
      return { url: '', path: '', error: error as Error };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [bucketName]);

  const uploadBase64 = useCallback(async (
    base64: string,
    folder?: string
  ): Promise<UploadResult> => {
    try {
      // Convert base64 to blob
      const response = await fetch(base64);
      const blob = await response.blob();
      return uploadFile(blob, folder);
    } catch (error) {
      console.error('Base64 conversion error:', error);
      return { url: '', path: '', error: error as Error };
    }
  }, [uploadFile]);

  const deleteFile = useCallback(async (url: string): Promise<boolean> => {
    try {
      const filePath = extractPathFromUrl(url);
      if (!filePath) return false;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }, [bucketName, extractPathFromUrl]);

  return {
    uploadFile,
    uploadBase64,
    deleteFile,
    getSignedUrl,
    getViewUrl,
    extractPathFromUrl,
    isUploading,
    uploadProgress,
  };
}
