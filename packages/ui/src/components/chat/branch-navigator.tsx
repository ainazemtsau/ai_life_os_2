'use client';

import * as React from 'react';
import type { Message } from '@ai-life-os/contracts';

interface BranchNavigatorProps {
  siblings: Message[];
  currentMessageId: string;
  onNavigate: (targetMessageId: string) => void;
}

export function BranchNavigator({ siblings, currentMessageId, onNavigate }: BranchNavigatorProps) {
  if (siblings.length <= 1) return null;

  const currentIndex = siblings.findIndex((m) => m.id === currentMessageId);
  // Fallback when currentMessageId not found (deleted/stale): show total count to indicate boundary
  const displayIndex = currentIndex === -1 ? siblings.length : currentIndex + 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(siblings[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < siblings.length - 1) {
      onNavigate(siblings[currentIndex + 1].id);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
      <button
        onClick={handlePrevious}
        disabled={currentIndex <= 0}
        className="disabled:opacity-30 hover:text-gray-200 disabled:hover:text-gray-400"
        type="button"
      >
        ←
      </button>
      <span>
        {displayIndex}/{siblings.length}
      </span>
      <button
        onClick={handleNext}
        disabled={currentIndex >= siblings.length - 1}
        className="disabled:opacity-30 hover:text-gray-200 disabled:hover:text-gray-400"
        type="button"
      >
        →
      </button>
    </div>
  );
}
