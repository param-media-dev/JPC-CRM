import { 
  collection, 
  addDoc, 
  getDoc,
  getDocs, 
  query, 
  orderBy, 
  Timestamp,
  serverTimestamp,
  doc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CVFile {
  id: string; // Changed to string for Firestore doc ID
  title: string;
  url: string;
  name: string;
  email: string;
  phone: string;
  date: string;
}

export const uploadFile = async (
  fileOrBase64: File | Blob | string, 
  metadata?: { name: string; email: string; phone: string; filename?: string }
): Promise<string> => {
  let fileUrl: string;
  let fileName: string = metadata?.filename || 'file';
  let fileType: string = 'application/octet-stream';
  let fileSize: number = 0;

  try {
    if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
      fileSize = fileOrBase64.size;
      fileName = (fileOrBase64 as File).name || fileName;
      fileType = fileOrBase64.type || fileType;
      
      // Convert file/blob to base64 data URL
      fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(new Error('Failed to read file locally: ' + e));
        reader.readAsDataURL(fileOrBase64);
      });
    } else {
      // It's already a base64 string or data URL
      fileUrl = fileOrBase64;
      fileSize = (fileUrl.length * 3) / 4; // Approximate size
      if (fileUrl.startsWith('data:')) {
        fileType = fileUrl.split(':')[1].split(';')[0];
      }
    }

    // Allow files up to 5MB
    if (fileSize > 5 * 1024 * 1024) {
      throw new Error('File is too large for database storage. Max 5MB.');
    }

    const isChunked = fileUrl.length > 800000;

    // Save entry to Firestore immediately
    const docRef = await addDoc(collection(db, 'jpc_cv_files'), {
      title: fileName,
      url: fileUrl, 
      isChunked: isChunked,
      name: metadata?.name || fileName.split('.')[0],
      email: metadata?.email || 'N/A',
      phone: metadata?.phone || '',
      date: new Date().toISOString().replace('T', ' ').split('.')[0],
      createdAt: serverTimestamp()
    });

    const docId = docRef.id;

    if (isChunked) {
      // Split the fileUrl into safe slices of 600,000 characters
      const chunkSize = 600000;
      const chunks: string[] = [];
      for (let i = 0; i < fileUrl.length; i += chunkSize) {
        chunks.push(fileUrl.substring(i, i + chunkSize));
      }

      // Record chunk count and update main doc
      await updateDoc(doc(db, 'jpc_cv_files', docId), {
        url: 'chunked', // Placeholder for chunked data
        chunkCount: chunks.length
      });

      // Write chunks in a batched transaction
      const chunksCol = collection(db, 'jpc_cv_files', docId, 'chunks');
      const batch = writeBatch(db);
      for (let i = 0; i < chunks.length; i++) {
        const chunkDocRef = doc(chunksCol, `chunk_${i}`);
        batch.set(chunkDocRef, {
          index: i,
          data: chunks[i]
        });
      }
      await batch.commit();

      console.log(`Stored chunked file of size ${fileUrl.length} in ${chunks.length} chunks successfully:`, docId);
    } else {
      console.log('File stored successfully in Firestore:', docId);
    }

    // ALWAYS return a reference string, never the raw base64
    return `dbfile:${docId}`;
  } catch (error) {
    console.error('Firestore upload error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to save file to Firestore.');
  }
};

export const listFiles = async (): Promise<CVFile[]> => {
  try {
    const q = query(collection(db, 'jpc_cv_files'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        url: `dbfile:${doc.id}`, // Return the reference URL
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        date: data.date || '',
      } as CVFile;
    });
  } catch (error) {
    console.error('List files error from Firestore:', error);
    throw error;
  }
};

export const resolveUrl = async (url: string): Promise<string> => {
  if (!url) return '';
  
  // Handle both "chunked:docId" (old format) and "dbfile:docId" (new format)
  if (url.startsWith('chunked:') || url.startsWith('dbfile:')) {
    const docId = url.split(':')[1];
    try {
      // Get the main document first
      const docSnap = await getDoc(doc(db, 'jpc_cv_files', docId));
      if (!docSnap.exists()) return '';
      
      const data = docSnap.data();
      
      // If it's chunked, fetch chunks
      if (data.isChunked || data.url === 'chunked') {
        const chunksCol = collection(db, 'jpc_cv_files', docId, 'chunks');
        const q = query(chunksCol, orderBy('index', 'asc'));
        const querySnapshot = await getDocs(q);
        
        const chunkDocs = querySnapshot.docs.map(doc => doc.data());
        chunkDocs.sort((a, b) => (a.index || 0) - (b.index || 0));
        
        return chunkDocs.map(c => c.data || '').join('');
      }
      
      // Otherwise return the url field which should have the full base64
      return data.url || '';
    } catch (error) {
      console.error('Error resolving URL for:', docId, error);
      throw new Error('Failed to load file content from database.');
    }
  }
  return url;
};

export const handleViewFile = async (url: string, filename: string = 'file') => {
  if (!url) return;

  let cleanFilename = filename;
  let resolvedUrl = url;
  
  try {
    resolvedUrl = await resolveUrl(url);
  } catch (e) {
    console.error('Failed code path fallback for resolving:', e);
  }

  if (!resolvedUrl) return;

  // Check if it's a data URL (base64)
  if (resolvedUrl.startsWith('data:')) {
    try {
      // Create a blob from the data URL
      const parts = resolvedUrl.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      
      // Ensure physical filename extension matches mime type if not present
      if (!cleanFilename.includes('.')) {
        if (mimeString === 'application/pdf') cleanFilename += '.pdf';
        else if (mimeString.includes('word')) cleanFilename += '.docx';
        else if (mimeString.includes('image')) cleanFilename += '.png';
        else cleanFilename += '.doc';
      }

      // Inside iframes, browser sandboxing can prevent window.open from functioning.
      // Triggering an anchor click with target="_blank" and download support is the standard solution.
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 200);
    } catch (e) {
      console.error('Error opening base64 file:', e);
      // Fallback
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.target = '_blank';
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 200);
    }
  } else {
    // Normal URL
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.target = '_blank';
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  }
};
