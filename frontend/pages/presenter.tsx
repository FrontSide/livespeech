import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import PresenterControl from '../components/PresenterControl';
import SpeechDisplay from '../components/SpeechDisplay';
import { API_URL } from '../config';

export default function Presenter() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState('');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [currentSectionText, setCurrentSectionText] = useState('');

  useEffect(() => {
    // Check if already authenticated (e.g., from session/localStorage)
    // For now, require login each time
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Connect to Socket.io - use same origin with /socket.io/ path
    const newSocket = io(API_URL, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected to:', API_URL);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    setSocket(newSocket);

    // Load initial state - presenter always uses English
    axios.get(`${API_URL}/api/speech`, {
      params: { lang: 'en' },
      timeout: 10000,
    })
      .then((response) => {
        console.log('Initial state loaded:', response.data);
        setSections(response.data.sections || []);
        setCurrentSectionIndex(response.data.currentSectionIndex);
        setCurrentText(response.data.renderedText || '');
        setIsRendering(response.data.isRendering || false);
        if (response.data.currentSectionIndex >= 0 && response.data.sections) {
          setCurrentSectionText(response.data.sections[response.data.currentSectionIndex] || '');
        }
      })
      .catch((error) => {
        console.error('Failed to load speech:', error);
      });

    // Listen for next section events - presenter always uses English
    newSocket.on('nextSection', (data: { sectionIndex: number; sectionText: string | { en: string; fr: string; de: string }; isRendering: boolean }) => {
      setCurrentSectionIndex(data.sectionIndex);
      // Extract English text for presenter
      const englishText = typeof data.sectionText === 'string' 
        ? data.sectionText 
        : (data.sectionText?.en || '');
      setCurrentSectionText(englishText);
      setIsRendering(true);
      setCurrentText('');
    });

    // Listen for reset events
    newSocket.on('reset', () => {
      setCurrentSectionIndex(-1);
      setCurrentText('');
      setCurrentSectionText('');
      setIsRendering(false);
    });

    // Listen for current state - presenter always uses English
    newSocket.on('currentState', (state: any) => {
      setCurrentSectionIndex(state.currentSectionIndex);
      setCurrentText(state.renderedText || '');
      // Extract English text for presenter
      const englishText = typeof state.sectionText === 'string' 
        ? state.sectionText 
        : (state.sectionText?.en || '');
      setCurrentSectionText(englishText);
      setIsRendering(state.isRendering);
    });

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    
    setError(''); // Clear previous errors
    
    try {
      const response = await axios.post(`${API_URL}/api/auth`, { password }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.data.success) {
        setIsAuthenticated(true);
        setStoredPassword(password); // Store password for API calls
        setPassword(''); // Clear visible password
        setError('');
        // Load current state
        loadCurrentState();
      } else {
        setError('Invalid password');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'ECONNABORTED') {
        setError('Connection timeout. Please check your network.');
      } else if (error.response) {
        setError(error.response?.data?.error || 'Authentication failed');
      } else if (error.request) {
        setError('Cannot connect to server. Please check the URL.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    }
  };

  const loadCurrentState = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/speech`, {
        params: { lang: 'en' }, // Presenter always uses English
        timeout: 10000,
      });
      setCurrentSectionIndex(response.data.currentSectionIndex);
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  };

  const handleNext = async () => {
    try {
      await axios.post(`${API_URL}/api/next`, { password: storedPassword });
      setCurrentSectionIndex(prev => prev + 1);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to advance');
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset the speech?')) {
      try {
        await axios.post(`${API_URL}/api/reset`, { password: storedPassword });
        setCurrentSectionIndex(-1);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to reset');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>Presenter Login - LiveSpeech</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>
        <div className="presenter-login-container">
          <div className="presenter-login-box">
            <h1>Presenter Login</h1>
            <form onSubmit={handleLogin} className="password-form">
              <input
                type="password"
                placeholder="Enter presenter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                  }
                }}
                className="password-input"
                autoFocus
                autoComplete="current-password"
              />
              {error && <div className="error-message">{error}</div>}
              <button 
                type="button"
                onClick={() => handleLogin()}
                className="login-btn"
              >
                Login
              </button>
            </form>
            <button 
              onClick={() => router.push('/')} 
              className="back-btn"
            >
              Back to Viewer
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Presenter Control - LiveSpeech</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <div className="presenter-container">
        <header className="presenter-header">
          <button 
            onClick={() => router.push('/')} 
            className="view-link"
          >
            View Live Speech
          </button>
          <button 
            onClick={handleReset} 
            className="reset-btn-header"
            title="Reset Speech"
          >
            Reset
          </button>
        </header>
        <main className="presenter-main">
          <div className="presenter-speech-view">
            <SpeechDisplay
              text={currentText}
              isRendering={isRendering}
              sectionIndex={currentSectionIndex}
              sectionText={currentSectionText}
              socket={socket}
            />
          </div>
          <PresenterControl
            onNext={handleNext}
            onReset={handleReset}
            currentSection={currentSectionIndex}
          />
        </main>
      </div>
    </>
  );
}
