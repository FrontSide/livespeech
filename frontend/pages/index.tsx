import { useState, useEffect } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import SpeechDisplay from '../components/SpeechDisplay';
import LanguageSelector from '../components/LanguageSelector';
import { API_URL } from '../config';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇮🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇦🇹' }
];

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [currentText, setCurrentText] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [sections, setSections] = useState<string[]>([]);
  const [currentSectionText, setCurrentSectionText] = useState<{ en: string; fr: string; de: string } | string>('');

  useEffect(() => {
    // Connect to Socket.io - use same origin with /speech/socket.io/ path
    const newSocket = io(API_URL, {
      path: '/speech/socket.io/',
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

    // Load initial state with selected language
    const loadSpeech = async () => {
      try {
        const response = await axios.get(`${API_URL}/speech/api/speech`, {
          params: { lang: selectedLanguage },
          timeout: 10000,
        });
        console.log('Initial state loaded:', response.data);
        setSections(response.data.sections || []);
        setCurrentSectionIndex(response.data.currentSectionIndex);
        setCurrentText(response.data.renderedText || '');
        setIsRendering(response.data.isRendering || false);
        if (response.data.currentSectionIndex >= 0 && response.data.sections) {
          setCurrentSectionText(response.data.sections[response.data.currentSectionIndex] || '');
        }
      } catch (error) {
        console.error('Failed to load speech:', error);
      }
    };
    
    loadSpeech();

    // Listen for next section events
    newSocket.on('nextSection', (data: { sectionIndex: number; sectionText: string | { en: string; fr: string; de: string }; isRendering: boolean }) => {
      setCurrentSectionIndex(data.sectionIndex);
      setCurrentSectionText(data.sectionText);
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

    // Listen for current state
    newSocket.on('currentState', (state: any) => {
      setCurrentSectionIndex(state.currentSectionIndex);
      setCurrentText(state.renderedText || '');
      setCurrentSectionText(state.sectionText || '');
      setIsRendering(state.isRendering);
    });

    return () => {
      newSocket.close();
    };
  }, [selectedLanguage]);

  // Get the text for the selected language
  const getTextForLanguage = (text: string | { en: string; fr: string; de: string }): string => {
    if (typeof text === 'string') {
      return text;
    }
    if (typeof text === 'object' && text !== null) {
      return text[selectedLanguage as keyof typeof text] || text.en || '';
    }
    return '';
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    // Reload speech with new language
    axios.get(`${API_URL}/speech/api/speech`, {
      params: { lang },
      timeout: 10000,
    })
      .then((response) => {
        setSections(response.data.sections || []);
        if (currentSectionIndex >= 0 && response.data.sections) {
          setCurrentSectionText(response.data.sections[currentSectionIndex] || '');
        }
      })
      .catch((error) => {
        console.error('Failed to load speech:', error);
      });
  };


  return (
    <>
      <Head>
        <title>LiveSpeech</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="description" content="Live speech presentation viewer" />
      </Head>
      <div className="container">
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          languages={LANGUAGES}
          isSpeechActive={currentSectionIndex >= 0}
        />
        <main>
          <SpeechDisplay
            text={currentText}
            isRendering={isRendering}
            sectionIndex={currentSectionIndex}
            sectionText={getTextForLanguage(currentSectionText)}
            socket={socket}
            selectedLanguage={selectedLanguage}
          />
        </main>
      </div>
    </>
  );
}
