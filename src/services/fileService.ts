export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    const result = await response.json();
    if (result.success && result.data && result.data.url) {
      return result.data.url;
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};
