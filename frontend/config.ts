/**
 * Backend API Configuration
 * 
 * Since frontend and backend run on the same port, we use relative URLs.
 * The API is available at /api on the same server.
 * Socket.io is available at /socket.io/ on the same server.
 * 
 * No configuration needed - this will automatically use the same host/port as the frontend.
 */
export const API_URL = typeof window !== 'undefined' 
  ? window.location.origin // Use same origin in browser
  : 'http://localhost:3000'; // Fallback for SSR
