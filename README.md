# LiveSpeech

A real-time web application for presenting speeches with live text display. The presenter can control the flow of text sections, which are displayed to all visitors in real-time with a chatbot-style typing animation.

## Features

- **Real-time Updates**: Uses Socket.io for instant synchronization across all connected clients
- **Presenter Control**: Password-protected presenter interface to advance through speech sections
- **Chatbot-style Rendering**: Text appears character-by-character with a typing animation
- **Visitor View**: Read-only interface for audience members
- **Simple Setup**: Easy to configure and deploy

## Project Structure

```
livespeech/
├── backend/          # Express server with Socket.io
│   ├── server.js    # Main server file
│   └── speech.json  # Speech content (sections)
├── frontend/        # Next.js React application
│   ├── pages/       # Next.js pages
│   ├── components/  # React components
│   └── styles/      # CSS styles
└── package.json     # Root package.json for running both servers
```

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure backend** (required):
   - **REQUIRED**: Set `PRESENTER_PASSWORD` environment variable (no default for security)
   - Set `PORT` if you want a different port (default: `3000`)
   - Set `HOST` to bind to a specific IP (default: `0.0.0.0` - listens on all interfaces)
   - Set `ALLOWED_ORIGINS` for production (comma-separated list, e.g., `http://example.com,https://example.com`)
   - Example: `PRESENTER_PASSWORD=mysecret PORT=3000 HOST=0.0.0.0 npm run dev`

3. **No frontend configuration needed**:
   - Frontend and backend run on the same port
   - API automatically uses the same origin (no config needed)

4. **Edit speech content**:
   - Edit `backend/speech.json` to customize your speech sections
   - Each string in the `sections` array is a paragraph that will be displayed

5. **Run the application**:
   ```bash
   npm run dev
   ```

   This will start both the frontend and backend on port 3000 (single port).

   **To run on a specific IP address** (accessible from other devices on your network):
   ```bash
   # Option 1: Set IP as environment variable
   HOST_IP=192.168.1.100 npm run dev:ip
   
   # Option 2: On Windows PowerShell
   $env:HOST_IP="192.168.1.100"; npm run dev:ip
   
   # Option 3: Defaults to 0.0.0.0 (all interfaces) if not set
   npm run dev:ip
   ```

   Replace `192.168.1.100` with your actual local IP address. Find it with:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

## Usage

1. **As a Presenter**:
   - Open the website
   - Enter the presenter password (default: `admin123`)
   - Click "Login as Presenter"
   - Use "Next Section" button to advance through speech sections
   - Use "Reset Speech" to start over

2. **As a Visitor**:
   - Simply open the website
   - Watch the live text appear as the presenter advances sections
   - No login required - read-only access

## Customization

### Changing Speech Content

Edit `backend/speech.json`:
```json
{
  "sections": [
    "Your first paragraph here...",
    "Your second paragraph here...",
    "And so on..."
  ]
}
```

### Changing Password

Set `PRESENTER_PASSWORD` in `backend/.env`:
```
PRESENTER_PASSWORD=your_secure_password
```

### Adjusting Typing Speed

Edit `frontend/components/SpeechDisplay.tsx` and change the interval:
```typescript
intervalRef.current = setInterval(() => {
  // ...
}, 30); // Change 30ms to adjust speed (lower = faster)
```

### Running on a Specific IP Address

The simplest way to run on a specific IP address:

**Using environment variable:**
```bash
# Linux/Mac
HOST_IP=192.168.1.100 npm run dev:ip

# Windows PowerShell
$env:HOST_IP="192.168.1.100"; npm run dev:ip

# Windows CMD
set HOST_IP=192.168.1.100 && npm run dev:ip
```

**Using default (0.0.0.0 - all interfaces):**
```bash
npm run dev:ip
```

This will:
- Start backend on the specified IP (or 0.0.0.0) on port 3001
- Start frontend on the specified IP (or 0.0.0.0) on port 3000
- Automatically configure frontend to connect to backend at the correct IP

**Access from other devices:**
- Open `http://YOUR_IP_ADDRESS:3000` in a browser on any device on the same network
- If using 0.0.0.0, use your machine's actual IP address (find it with `ipconfig` or `ifconfig`)

**Note**: Replace `192.168.1.100` with your actual local IP address

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Styling**: CSS with modern gradients and animations

## Development

- Both frontend and backend run on the same port: `http://localhost:3000`
- Backend API is available at: `http://localhost:3000/api`
- Socket.io is available at: `http://localhost:3000/socket.io/`

**Note**: The backend is now integrated into the frontend server, so you only need to open one port (3000) on your host machine.

## Docker Deployment

### Quick Start with Docker Compose

1. **Create a `.env` file** in the project root:
   ```
   PRESENTER_PASSWORD=your_secure_password_here
   PORT=3000
   ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
   ```

2. **Build and run**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

4. **Stop the container**:
   ```bash
   docker-compose down
   ```

### Building Docker Image Manually

```bash
# Build the image
docker build -t livespeech:latest .

# Run the container
docker run -d \
  --name livespeech \
  -p 3000:3000 \
  -e PRESENTER_PASSWORD=your_secure_password \
  -e ALLOWED_ORIGINS=http://your-domain.com \
  -v $(pwd)/backend/speech.json:/app/backend/speech.json:ro \
  livespeech:latest
```

### Development with Docker

For development with hot reload:

```bash
docker-compose -f docker-compose.dev.yml up
```

### Updating Speech Content

The `speech.json` file is mounted as a volume, so you can edit it directly:

```bash
# Edit the file
nano backend/speech.json

# Restart the container to reload
docker-compose restart
```

**Note**: If `backend/speech.json` doesn't exist on your host, the container will create a default one. You can then edit it and restart the container.

### Environment Variables

Required:
- `PRESENTER_PASSWORD` - Password for presenter authentication (required)

Optional:
- `PORT` - Port to run on (default: 3000)
- `HOST` - Host to bind to (default: 0.0.0.0)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (for production)
- `NODE_ENV` - Set to `production` for production builds

## License

ISC
