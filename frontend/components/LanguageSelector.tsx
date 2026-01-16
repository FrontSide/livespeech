interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  languages: { code: string; name: string; flag: string }[];
  isSpeechActive: boolean;
}

export default function LanguageSelector({ selectedLanguage, onLanguageChange, languages, isSpeechActive }: LanguageSelectorProps) {
  return (
    <div className={`language-selector ${isSpeechActive ? 'compact' : ''}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onLanguageChange(lang.code)}
          className={`lang-btn ${selectedLanguage === lang.code ? 'active' : ''}`}
        >
          <span className="lang-flag">{lang.flag}</span>
          <span className="lang-name">{lang.name}</span>
        </button>
      ))}
    </div>
  );
}
