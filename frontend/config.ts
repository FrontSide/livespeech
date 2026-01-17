/**
 * Backend API Configuration
 * 
 * Since frontend and backend run on the same port, we use relative URLs.
 * The API is available at /speech/api on the same server.
 * Socket.io is available at /speech/socket.io/ on the same server.
 * 
 * All endpoints are prefixed with /speech for reverse proxy compatibility.
 */
export const API_URL = typeof window !== 'undefined' 
  ? window.location.origin // Use same origin in browser
  : 'http://localhost:3000'; // Fallback for SSR
