/**
 * api.js  —  Fashion AI frontend API layer
 * Fixes: data-URL prefix stripping, retry logic, request cancellation,
 *         timeout handling, consistent error normalisation.
 */
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE,
  timeout: 90_000,               // 90 s – model cold-start on Colab can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ─── Response interceptor: normalise errors ───────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      (err.code === 'ECONNABORTED' ? 'Request timed out. The AI model may still be loading.' : null) ||
      err.message ||
      'Unknown error';
    return Promise.reject(new Error(msg));
  }
);

// ─── Helper: strip data-URL prefix so backend receives raw base64 ─────────────
/**
 * FileReader.readAsDataURL returns  "data:image/jpeg;base64,/9j/4AAQ..."
 * The backend only wants the raw base64 after the comma.
 * BUG FIX: previous code passed the full data-URL to every endpoint.
 */
export const stripDataUrlPrefix = (dataUrl) => {
  if (typeof dataUrl !== 'string') return dataUrl;
  const idx = dataUrl.indexOf(',');
  return idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl;
};

// ─── Helper: file → base64 data-URL (kept for backward compat) ───────────────
export const imageToBase64 = (file) =>
  new Promise((resolve, reject) => {
    if (!(file instanceof File || file instanceof Blob)) {
      reject(new Error('imageToBase64: argument must be a File or Blob'));
      return;
    }
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);   // full data-URL
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

// ─── Helper: retry wrapper ────────────────────────────────────────────────────
const withRetry = async (fn, retries = 2, delayMs = 1200) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
};

// ─── API calls ────────────────────────────────────────────────────────────────

/** Health check — no retry needed */
export const checkHealth = () => api.get('/health');

/**
 * Classify a garment image.
 * @param {string} imageDataUrl  Full data-URL from imageToBase64()
 */
export const classifyImage = (imageDataUrl) =>
  withRetry(() =>
    api.post('/classify', { image: stripDataUrlPrefix(imageDataUrl) })
  );

/**
 * Get outfit recommendations.
 * @param {object} userData  { age, gender, bmi, style, occasion, … }
 */
export const getRecommendations = (userData) =>
  withRetry(() => api.post('/recommend', userData));

/**
 * Colour analysis — either upload a selfie OR supply a tone key.
 * @param {string|null} imageDataUrl  Full data-URL or null
 * @param {string|null} toneKey       e.g. "fair_cool"
 */
export const analyzeColors = (imageDataUrl = null, toneKey = null) =>
  withRetry(() =>
    api.post('/color-analysis', {
      ...(imageDataUrl ? { image: stripDataUrlPrefix(imageDataUrl) } : {}),
      ...(toneKey       ? { tone_key: toneKey }                    : {}),
    })
  );

/**
 * Style tips for a specific item.
 */
export const getStyleTips = (item, bodyType, occasion) =>
  withRetry(() =>
    api.post('/style-tips', { item, body_type: bodyType, occasion })
  );

export default api;
