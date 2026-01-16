const { spawn } = require('child_process');
const { networkInterfaces } = require('os');
const path = require('path');

// Get actual IP address when 0.0.0.0 is specified
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const HOST_IP = process.env.HOST_IP || '0.0.0.0';
const BACKEND_PORT = process.env.PORT || '3001';
const FRONTEND_PORT = '3000';

// For API URL: use actual IP if 0.0.0.0, otherwise use specified IP
const API_IP = HOST_IP === '0.0.0.0' ? getLocalIP() : HOST_IP;
const DISPLAY_IP = HOST_IP === '0.0.0.0' ? getLocalIP() : HOST_IP;

console.log(`Starting LiveSpeech on IP: ${HOST_IP === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST_IP}`);
console.log(`Backend: http://${DISPLAY_IP}:${BACKEND_PORT}`);
console.log(`Frontend: http://${DISPLAY_IP}:${FRONTEND_PORT}`);

// Start backend
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..', 'backend'),
  env: {
    ...process.env,
    HOST: HOST_IP,
    PORT: BACKEND_PORT
  },
  shell: true,
  stdio: 'inherit'
});

// Use detected IP for API URL so it works from other devices
const frontendApiUrl = `http://${API_IP}:${BACKEND_PORT}`;

const frontend = spawn('npx', ['next', 'dev', '-H', HOST_IP], {
  cwd: path.join(__dirname, '..', 'frontend'),
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: frontendApiUrl
  },
  shell: true,
  stdio: 'inherit'
});

// Handle exit
process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  backend.kill();
  frontend.kill();
  process.exit();
});
