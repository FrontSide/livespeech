import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface SpeechDisplayProps {
  text: string;
  isRendering: boolean;
  sectionIndex: number;
  sectionText: string;
  socket: Socket | null;
  selectedLanguage?: string;
}

const PLACEHOLDER_TEXT = {
  en: 'The speech will begin after Dinner at 8pm...',
  fr: 'Le discours commencera après le dîner à 20h...',
  de: 'Die Ansprache beginnt nach dem Abendessen um 20 Uhr...'
};

export default function SpeechDisplay({ text, isRendering, sectionIndex, sectionText, socket, selectedLanguage = 'en' }: SpeechDisplayProps) {
  const [displayedText, setDisplayedText] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSectionIndexRef = useRef<number>(-1);

  // Reset displayed text when a new section starts
  useEffect(() => {
    if (sectionIndex !== lastSectionIndexRef.current && isRendering && sectionText) {
      setDisplayedText('');
      lastSectionIndexRef.current = sectionIndex;
    }
  }, [sectionIndex, isRendering, sectionText]);

  // Handle text rendering animation
  useEffect(() => {
    // If we have a section to render and we're in rendering mode
    if (isRendering && sectionText && displayedText.length < sectionText.length) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(() => {
        setDisplayedText((prev) => {
          if (prev.length >= sectionText.length) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            return prev;
          }
          const nextChar = sectionText[prev.length];
          if (nextChar) {
            return prev + nextChar;
          }
          return prev;
        });
      }, 30); // 30ms per character for smooth typing effect

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else if (!isRendering && intervalRef.current) {
      // Stop rendering if isRendering becomes false
      clearInterval(intervalRef.current);
    }
  }, [isRendering, sectionText, displayedText]);

  // Update displayed text when not rendering (show full text)
  useEffect(() => {
    if (!isRendering) {
      // If we have pre-rendered text, use it
      if (text) {
        setDisplayedText(text);
      }
      // Otherwise, if we have section text, show the full section
      else if (sectionText && sectionIndex >= 0) {
        setDisplayedText(sectionText);
      }
      // If no section, clear text
      else if (sectionIndex < 0) {
        setDisplayedText('');
      }
    }
  }, [text, isRendering, sectionText, sectionIndex]);

  const placeholderText = PLACEHOLDER_TEXT[selectedLanguage as keyof typeof PLACEHOLDER_TEXT] || PLACEHOLDER_TEXT.en;

  return (
    <div className="speech-display">
      <div className="speech-content">
        {displayedText || (sectionIndex < 0 && <span className="empty-state">{placeholderText}</span>)}
        {isRendering && displayedText.length < sectionText.length && (
          <span className="cursor">|</span>
        )}
      </div>
    </div>
  );
}
