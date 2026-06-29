// Browser → Cloudinary direct unsigned upload.
// Uses an UNSIGNED upload preset configured in Cloudinary.

export async function uploadImage(file, folder = 'uploads', onProgress) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    const errorMsg = 'Cloudinary configuration missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
  console.log(`[Cloudinary Upload] URL: ${uploadUrl}, Preset: ${uploadPreset}, Folder: ${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        console.log(`[Cloudinary Response] Status: ${xhr.status}`, data);
        
        if (xhr.status === 200) {
          resolve(data.secure_url);
        } else {
          reject(new Error(data.error?.message || 'Cloudinary upload failed'));
        }
      } catch {
        reject(new Error('Invalid response from Cloudinary'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during image upload'));
    xhr.send(formData);
  });
}

// Upload multiple files in parallel with unified progress.
export async function uploadImages(files, folder = 'uploads', onProgress) {
  if (!files.length) return [];
  const progressMap = new Array(files.length).fill(0);
  return Promise.all(
    files.map((file, i) =>
      uploadImage(file, folder, (pct) => {
        progressMap[i] = pct;
        if (onProgress) {
          const avg = Math.round(progressMap.reduce((a, b) => a + b, 0) / progressMap.length);
          onProgress(avg);
        }
      })
    )
  );
}
