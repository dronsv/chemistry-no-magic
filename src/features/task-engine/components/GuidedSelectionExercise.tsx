import { useState, useCallback } from 'react';
import './GuidedSelectionExercise.css';

interface GuidedSelectionProps {
  chain: string[];
  gapIndex: number;
  options: Array<{ id: string; text: string }>;
  onSelect: (optionId: string) => void;
}

export function GuidedSelectionExercise({
  chain,
  gapIndex,
  options,
  onSelect,
}: GuidedSelectionProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handleGapClick = useCallback(() => {
    setShowOptions(prev => !prev);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setShowOptions(false);
      onSelect(id);
    },
    [onSelect],
  );

  return (
    <div className="guided-selection">
      <div className="chain-row">
        {chain.map((substance, i) => (
          <div key={i} className="chain-item-wrapper">
            {i > 0 && <span className="chain-arrow">{'\u2192'}</span>}
            {i === gapIndex ? (
              <button
                className="chain-gap"
                onClick={handleGapClick}
                aria-label="Select substance"
                aria-expanded={showOptions}
              >
                ?
              </button>
            ) : (
              <span className="chain-substance">{substance}</span>
            )}
          </div>
        ))}
      </div>

      {showOptions && (
        <div className="selection-panel" role="listbox" aria-label="Select substance">
          {options.map(opt => (
            <button
              key={opt.id}
              className="candidate-btn"
              role="option"
              onClick={() => handleSelect(opt.id)}
            >
              {opt.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
