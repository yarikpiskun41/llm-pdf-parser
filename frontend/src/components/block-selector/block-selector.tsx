import React from 'react';
import './block-selector.css';
import {DocumentBlock} from "../../types/document.types.ts";
import {BlockItem} from "./components/block-item/block-item.tsx";

interface BlockSelectorProps {
  blocks: DocumentBlock[];
  selectedBlockIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}


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