import React, {useState} from "react";
import {DocumentBlock} from "../../../../types/document.types.ts";
import {FaChevronDown, FaChevronUp} from "react-icons/fa";

export const BlockItem: React.FC<{
  block: DocumentBlock;
  isSelected: boolean;
  onCheckboxChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}> = ({block, isSelected, onCheckboxChange, disabled}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentLengthThreshold = 300;
  const canExpand = block.content.length > contentLengthThreshold;

  const toggleExpand = () => {
    if (canExpand) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={`block-item block-type-${block.type.replace(/[^a-zA-Z0-9]/g, '-')}`}>
      <div className="block-header">
        <input
          type="checkbox"
          id={`block-${block.id}`}
          value={block.id}
          checked={isSelected}
          onChange={onCheckboxChange}
          disabled={disabled}
          aria-labelledby={`label-${block.id}`}
        />
        <label id={`label-${block.id}`} htmlFor={`block-${block.id}`}>
          <strong>{block.label}</strong> <span className="block-type">({block.type})</span>
        </label>
        {canExpand && (
          <button onClick={toggleExpand} className="expand-button" aria-expanded={isExpanded}>
            {isExpanded ? <FaChevronUp/> : <FaChevronDown/>}
            <span>{isExpanded ? 'Hide' : 'Show'} Content</span>
          </button>
        )}
      </div>
      <pre className="block-content">
  {canExpand && !isExpanded
    ? `${block.content.substring(0, contentLengthThreshold)}...`
    : block.content}
  </pre>
    </div>
  );
};