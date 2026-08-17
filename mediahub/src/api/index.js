// import axios from 'axios';

// export const API_URL = 'https://media-hub-bq9w.onrender.com';

// console.log('🔍 API_URL:', API_URL);

// // The 45s default below is tuned for Render free-tier cold starts on normal
// // JSON requests (login, fetch posts, etc). It is deliberately NOT used for
// // media uploads — see UPLOAD_TIMEOUT below. Applying the cold-start timeout
// // to an upload meant large files (esp. video) got silently aborted by axios
// // partway through, which looked like "upload freezes/cancels around 30%".
// const DEFAULT_TIMEOUT = 45000;
// // Uploads need a much longer budget: cold start (~30-50s) + actual transfer
// // time for a large file on a possibly slow connection. 10 minutes gives real
// // videos room to finish; adjust down if your backend/multer caps file size
// // lower and uploads should never legitimately take this long.
// const UPLOAD_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// const api = axios.create({
//   baseURL: API_URL,
//   timeout: DEFAULT_TIMEOUT,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Add token to every request
// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('auth_token');
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     console.log('📤 Request:', config.method.toUpperCase(), config.baseURL + config.url);
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Response interceptor - handle cold starts, then 401/403 errors
// api.interceptors.response.use(
//   (response) => {
//     console.log('✅ API Response:', response.config.url, response.status);
//     return response;
//   },
//   async (error) => {
//     const config = error.config;

//     // Render free-tier cold starts show up as either a dropped connection
//     // (no error.response, e.g. ECONNABORTED/network error) or a 502/503/504
//     // from the edge proxy while the container is still spinning up.
//     // Retry once, after a short delay, for idempotent GET requests only.
//     const isColdStartError =
//       !error.response || [502, 503, 504].includes(error.response?.status);

//     if (isColdStartError && config && !config._retried && config.method === 'get') {
//       config._retried = true;
//       await new Promise((resolve) => setTimeout(resolve, 5000));
//       return api(config);
//     }

//     console.error('❌ API Error:', error.config?.url, error.response?.status, error.response?.data);

//     // If 401 or 403, only treat it as a session expiry if we actually had a token.
//     // Guests hitting a protected endpoint (e.g. liking a post while logged out)
//     // also get a 401/403, but that's not a session expiry — don't yank them
//     // off the page they're on.
//     if (error.response?.status === 401 || error.response?.status === 403) {
//       const hadToken = !!localStorage.getItem('auth_token');
//       if (hadToken) {
//         localStorage.removeItem('auth_token');
//         localStorage.removeItem('auth_user');
//         // Redirect to login if not already there
//         if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
//           window.location.href = '/login';
//         }
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// export const authAPI = {
//   login: (credentials) => api.post('/api/auth/login', credentials),
//   register: (userData) => api.post('/api/auth/register', userData),
//   getProfile: () => api.get('/api/auth/me'),
//   getMe: () => api.get('/api/auth/me'),
//   logout: () => api.post('/api/auth/logout'),
//   updateProfile: (data) => api.put('/api/auth/me', data),
//   updateAvatar: (file) => {
//     const formData = new FormData();
//     formData.append('avatar', file);
//     return api.put('/api/auth/me/avatar', formData, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//       timeout: UPLOAD_TIMEOUT,
//     });
//   },
//   changePassword: (data) => api.put('/api/auth/me/password', data), // { currentPassword, newPassword }
//   deleteAccount: () => api.delete('/api/auth/me'),
//   forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
//   resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword }),
//   getUserProfile: (userId) => api.get(`/api/auth/users/${userId}`),
// };

// // Posts API
// export const postsAPI = {
//   getAll: () => api.get('/api/posts'),
//   getOne: (id) => api.get(`/api/posts/${id}`),
//   // `config` lets callers pass extra axios options (e.g. onUploadProgress) through.
//   // timeout defaults to UPLOAD_TIMEOUT (not the global 45s cold-start timeout)
//   // since this endpoint carries the actual media file — a caller can still
//   // override it by passing `timeout` in `config` if it ever needs to.
//   create: (data, config = {}) => api.post('/api/posts', data, {
//     timeout: UPLOAD_TIMEOUT,
//     ...config,
//     headers: {
//       'Content-Type': 'multipart/form-data',
//       ...(config.headers || {}),
//     },
//   }),
//   update: (id, data, config = {}) => api.put(`/api/posts/${id}`, data, {
//     timeout: UPLOAD_TIMEOUT,
//     ...config,
//     headers: {
//       'Content-Type': 'multipart/form-data',
//       ...(config.headers || {}),
//     },
//   }),
//   delete: (id) => api.delete(`/api/posts/${id}`),
//   like: (id) => api.post(`/api/posts/${id}/like`),
//   dislike: (id) => api.post(`/api/posts/${id}/dislike`),
//   comment: (id, content) => api.post(`/api/comments/${id}`, { content }),
//   getMyPosts: () => api.get('/api/posts/my-posts'),
//   getLikers: (postId) => api.get(`/api/posts/${postId}/likes`),
// };

// // Notifications API
// export const notificationsAPI = {
//   getAll: (page = 1, limit = 20) => api.get(`/api/notifications?page=${page}&limit=${limit}`),
//   markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
//   markAllAsRead: () => api.put('/api/notifications/read-all'),
//   delete: (id) => api.delete(`/api/notifications/${id}`),
// };

// // Comments API
// export const commentsAPI = {
//   getByPost: (postId) => api.get(`/api/comments/${postId}`),
//   create: (postId, content) => api.post(`/api/comments/${postId}`, { content }),
//   delete: (commentId) => api.delete(`/api/comments/${commentId}`),
//   like: (commentId) => api.post(`/api/comments/${commentId}/like`),
// };

// /**
//  * Media download helpers
//  * ------------------------------------------------------------------
//  * The backend proxies Cloudinary media through GET /api/posts/download
//  * (see download.controller.js) so it can attach a Content-Disposition:
//  * attachment header — Cloudinary itself doesn't send one, and the classic
//  * `<a href={cloudinaryUrl} download>` trick is silently ignored by browsers
//  * for cross-origin URLs. It's a public route (no auth) and only proxies
//  * res.cloudinary.com/.../mediahub/... URLs, so it's safe to link to directly.
//  */

// // Build the proxy URL for a single Cloudinary asset.
// export const getDownloadUrl = (url, filename) => {
//   const params = new URLSearchParams({ url });
//   if (filename) params.set('filename', filename);
//   return `${API_URL}/api/posts/download?${params.toString()}`;
// };

// // Trigger a save for a single media item ({ type, url }).
// export const downloadMediaItem = (item, filename) => {
//   if (!item?.url) return;
//   const ext = item.type === 'video' ? 'mp4' : (item.url.split('.').pop() || 'jpg').split('?')[0];
//   const name = filename || `mediahub.${ext}`;
//   const link = document.createElement('a');
//   link.href = getDownloadUrl(item.url, name);
//   link.setAttribute('download', name);
//   document.body.appendChild(link);
//   link.click();
//   link.remove();
// };

// // Trigger saves for every media item on a post. Browsers will happily save
// // several files back-to-back, but firing them all in the same tick can get
// // the 2nd+ ones blocked as a "download popup" — stagger them slightly.
// export const downloadAllMedia = (items, baseName = 'mediahub-post') => {
//   (items || []).forEach((item, i) => {
//     if (!item?.url) return;
//     const ext = item.type === 'video' ? 'mp4' : (item.url.split('.').pop() || 'jpg').split('?')[0];
//     const name = items.length > 1 ? `${baseName}-${i + 1}.${ext}` : `${baseName}.${ext}`;
//     setTimeout(() => downloadMediaItem(item, name), i * 350);
//   });
// };

// export default api;








import axios from 'axios';

export const API_URL = process.env.VITE_BACKEND_API;

console.log('🔍 API_URL:', API_URL);

// The 45s default below is tuned for Render free-tier cold starts on normal
// JSON requests (login, fetch posts, etc). Post-creation is now a small JSON
// payload too (see postsAPI.create below — media is uploaded directly to
// Cloudinary by the browser, not through this backend), so it can safely use
// the same short timeout. Only the raw Cloudinary transfer itself needs a
// long timeout, and that's handled separately in uploadMediaDirect.
const DEFAULT_TIMEOUT = 45000;

const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('📤 Request:', config.method.toUpperCase(), config.baseURL + config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle cold starts, then 401/403 errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    return response;
  },
  async (error) => {
    const config = error.config;

    // Render free-tier cold starts show up as either a dropped connection
    // (no error.response, e.g. ECONNABORTED/network error) or a 502/503/504
    // from the edge proxy while the container is still spinning up.
    // Retry once, after a short delay, for idempotent GET requests only.
    const isColdStartError =
      !error.response || [502, 503, 504].includes(error.response?.status);

    if (isColdStartError && config && !config._retried && config.method === 'get') {
      config._retried = true;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return api(config);
    }

    console.error('❌ API Error:', error.config?.url, error.response?.status, error.response?.data);

    // If 401 or 403, only treat it as a session expiry if we actually had a token.
    // Guests hitting a protected endpoint (e.g. liking a post while logged out)
    // also get a 401/403, but that's not a session expiry — don't yank them
    // off the page they're on.
    if (error.response?.status === 401 || error.response?.status === 403) {
      const hadToken = !!localStorage.getItem('auth_token');
      if (hadToken) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Redirect to login if not already there
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  getProfile: () => api.get('/api/auth/me'),
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  updateProfile: (data) => api.put('/api/auth/me', data),
  // Avatar upload still goes through multer on the backend (utilities/upload.middleware.js,
  // 5MB image cap) — that route DOES expect multipart/form-data, unlike posts.
  updateAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.put('/api/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 2 * 60 * 1000,
    });
  },
  changePassword: (data) => api.put('/api/auth/me/password', data), // { currentPassword, newPassword }
  deleteAccount: () => api.delete('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword }),
  getUserProfile: (userId) => api.get(`/api/auth/users/${userId}`),
};

// Upload API — issues a signed direct-to-Cloudinary upload ticket.
// See routes/upload.routes.js: GET /api/upload/sign (protected)
export const uploadAPI = {
  getSignature: () => api.get('/api/upload/sign'),
};

// Posts API
//
// IMPORTANT: post.routes.js has NO multer on POST/PUT /api/posts — the
// controller (createPost/updatePost) reads req.body.images / req.body.videos
// as plain JSON arrays of { url, public_id, thumbnail?, duration? } that the
// browser already got back from Cloudinary via uploadMediaDirect() below.
// Sending FormData or forcing a multipart Content-Type header here will make
// express.json() skip parsing entirely and req.body will come back empty —
// that's the "can't upload at all" failure mode. Keep this JSON, always.
export const postsAPI = {
  getAll: () => api.get('/api/posts'),
  getOne: (id) => api.get(`/api/posts/${id}`),
  // data = { title?, content?, tags?, images?: [{url,public_id,...}], videos?: [{url,public_id,...}] }
  // config lets callers pass extra axios options through, e.g. { signal } to cancel.
  create: (data, config = {}) => api.post('/api/posts', data, config),
  update: (id, data, config = {}) => api.put(`/api/posts/${id}`, data, config),
  delete: (id) => api.delete(`/api/posts/${id}`),
  like: (id) => api.post(`/api/posts/${id}/like`),
  dislike: (id) => api.post(`/api/posts/${id}/dislike`),
  comment: (id, content) => api.post(`/api/comments/${id}`, { content }),
  getMyPosts: () => api.get('/api/posts/my-posts'),
  getLikers: (postId) => api.get(`/api/posts/${postId}/likes`),
};

// Notifications API
export const notificationsAPI = {
  getAll: (page = 1, limit = 20) => api.get(`/api/notifications?page=${page}&limit=${limit}`),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

// Comments API
export const commentsAPI = {
  getByPost: (postId) => api.get(`/api/comments/${postId}`),
  create: (postId, content) => api.post(`/api/comments/${postId}`, { content }),
  delete: (commentId) => api.delete(`/api/comments/${commentId}`),
  like: (commentId) => api.post(`/api/comments/${commentId}/like`),
};

/**
 * Direct-to-Cloudinary upload
 * ------------------------------------------------------------------
 * Uploads a single file straight from the browser to Cloudinary using the
 * short-lived signature from uploadAPI.getSignature(). Render never sees the
 * file bytes at all — only the small JSON metadata that comes back, which
 * gets attached to the post via postsAPI.create/update. This is what makes
 * uploads fast and what makes a genuine mid-upload Cancel possible: aborting
 * stops the actual byte transfer, not just some request to our own backend.
 *
 * Returns { url, public_id, thumbnail?, duration? } — matching exactly what
 * post.controller.js's sanitizeMediaArray() expects. public_id will start
 * with "mediahub/" because that's the folder baked into the signature, which
 * is what lets sanitizeMediaArray accept it.
 */
export async function uploadMediaDirect({ file, signatureData, onProgress, signal }) {
  const { signature, timestamp, folder, apiKey, cloudName } = signatureData;
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  // Plain axios (not the `api` instance) — this goes straight to Cloudinary,
  // not our backend, so it must NOT carry our Authorization/Bearer header.
  const res = await axios.post(uploadUrl, formData, {
    signal,
    timeout: 10 * 60 * 1000, // large videos on slow connections need real headroom
    onUploadProgress: (evt) => {
      if (!evt.total || !onProgress) return
      onProgress(Math.round((evt.loaded / evt.total) * 100))
    },
  });

  const data = res.data;
  const result = {
    url: data.secure_url,
    public_id: data.public_id,
  };
  if (isVideo) {
    // Cheap thumbnail: swap the video extension for .jpg — Cloudinary
    // auto-generates a frame at that derived URL on first request.
    result.thumbnail = data.secure_url.replace(/\.\w+$/, '.jpg');
    if (typeof data.duration === 'number') result.duration = data.duration;
  }
  return result;
}

/**
 * Media download helpers
 * ------------------------------------------------------------------
 * The backend proxies Cloudinary media through GET /api/posts/download
 * (see download.controller.js) so it can attach a Content-Disposition:
 * attachment header — Cloudinary itself doesn't send one, and the classic
 * `<a href={cloudinaryUrl} download>` trick is silently ignored by browsers
 * for cross-origin URLs. It's a public route (no auth) and only proxies
 * res.cloudinary.com/.../mediahub/... URLs, so it's safe to link to directly.
 */

// Build the proxy URL for a single Cloudinary asset.
export const getDownloadUrl = (url, filename) => {
  const params = new URLSearchParams({ url });
  if (filename) params.set('filename', filename);
  return `${API_URL}/api/posts/download?${params.toString()}`;
};

// Trigger a save for a single media item ({ type, url }).
export const downloadMediaItem = (item, filename) => {
  if (!item?.url) return;
  const ext = item.type === 'video' ? 'mp4' : (item.url.split('.').pop() || 'jpg').split('?')[0];
  const name = filename || `mediahub.${ext}`;
  const link = document.createElement('a');
  link.href = getDownloadUrl(item.url, name);
  link.setAttribute('download', name);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Trigger saves for every media item on a post. Browsers will happily save
// several files back-to-back, but firing them all in the same tick can get
// the 2nd+ ones blocked as a "download popup" — stagger them slightly.
export const downloadAllMedia = (items, baseName = 'mediahub-post') => {
  (items || []).forEach((item, i) => {
    if (!item?.url) return;
    const ext = item.type === 'video' ? 'mp4' : (item.url.split('.').pop() || 'jpg').split('?')[0];
    const name = items.length > 1 ? `${baseName}-${i + 1}.${ext}` : `${baseName}.${ext}`;
    setTimeout(() => downloadMediaItem(item, name), i * 350);
  });
};

export default api;
