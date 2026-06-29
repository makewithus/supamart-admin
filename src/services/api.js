import { auth } from '../config/firebase';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(method, path, body, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const isFormData = body instanceof FormData;
  
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await axios({
      method,
      url: `${BASE}${path}`,
      data: isFormData ? body : (body ? body : undefined),
      headers,
      timeout: 120_000,            // 2 min — enough for Cloudinary upload via backend
      maxBodyLength: 100 * 1024 * 1024,    // 100 MB
      maxContentLength: 100 * 1024 * 1024, // 100 MB
      onUploadProgress: options.onUploadProgress
    });
    return res.data;
  } catch (err) {
    if (err.response) {
      throw new Error(err.response.data?.error || err.response.statusText);
    }
    throw err;
  }
}

export const apiGet  = (path, options)       => request('GET',    path, null, options);
export const apiPost = (path, body, options) => request('POST',   path, body, options);
export const apiPatch= (path, body, options) => request('PATCH',  path, body, options);
export const apiPut  = (path, body, options) => request('PUT',    path, body, options);
export const apiDel  = (path, options)       => request('DELETE', path, null, options);
