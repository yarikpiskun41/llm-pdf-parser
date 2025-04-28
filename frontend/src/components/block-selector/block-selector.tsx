
import React, {useState} from 'react';
import './block-selector.css';
import {FaChevronDown, FaChevronUp} from 'react-icons/fa';
import {DocumentBlock} from "../../types/document.types.ts";

interface BlockSelectorProps {
  blocks: DocumentBlock[];
  selectedBlockIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

const BlockItem: React.FC<{
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


const BlockSelector: React.FC<BlockSelectorProps> = ({
                                                       blocks,
                                                       selectedBlockIds,
                                                       onSelectionChange,
                                                       disabled = false
                                                     }) => {

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const blockId = event.target.value;
    const isChecked = event.target.checked;
    const newSelectedIds = isChecked
      ? [...selectedBlockIds, blockId]
      : selectedBlockIds.filter(id => id !== blockId);
    onSelectionChange(newSelectedIds);
  };

  const handleSelectAll = (select: boolean) => {
    const allIds = select ? blocks.map(b => b.id) : [];
    onSelectionChange(allIds);
  };

  if (!blocks || blocks.length === 0) {
    return <p>No document blocks found to display.</p>;
  }

  return (
    <div className="block-selector">
      <div className="block-selector-controls">
        <button onClick={() => handleSelectAll(true)} disabled={disabled}>Select All Blocks</button>
        <button onClick={() => handleSelectAll(false)} disabled={disabled}>Deselect All Blocks</button>
        <p>Selected {selectedBlockIds.length} of {blocks.length} blocks.</p>
      </div>

      {blocks.map((block) => (
        <BlockItem
          key={block.id}
          block={block}
          isSelected={selectedBlockIds.includes(block.id)}
          onCheckboxChange={handleCheckboxChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default BlockSelector;