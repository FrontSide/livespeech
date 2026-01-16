interface PresenterControlProps {
  onNext: () => void;
  onReset: () => void;
  currentSection: number;
}

export default function PresenterControl({ onNext, onReset, currentSection }: PresenterControlProps) {
  return (
    <div className="presenter-controls">
      <div className="controls-header">
        <span className="section-info">Current Section: {currentSection + 1}</span>
      </div>
      <div className="controls-buttons">
        <button onClick={onNext} className="btn btn-primary">
          Next Section
        </button>
      </div>
    </div>
  );
}
