import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Create a WebSocket connection to the backend.
 * @param {string} path - WebSocket path (e.g., '/ws/mobility')
 * @param {object} handlers - { onMessage, onOpen, onClose, onError }
 * @returns {WebSocket}
 */
export function connectWebSocket(path, handlers = {}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}${path}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = (e) => {
    console.log(`WebSocket connected: ${path}`);
    handlers.onOpen?.(e);
  };

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      handlers.onMessage?.(data);
    } catch {
      handlers.onMessage?.(e.data);
    }
  };

  ws.onclose = (e) => {
    console.log(`WebSocket closed: ${path}`);
    handlers.onClose?.(e);
  };

  ws.onerror = (e) => {
    console.error(`WebSocket error: ${path}`, e);
    handlers.onError?.(e);
  };

  return ws;
}

export default api;
