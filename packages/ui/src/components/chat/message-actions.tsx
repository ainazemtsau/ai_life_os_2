'use client';

import * as React from 'react';

interface MessageActionsProps {
  content: string;
  onCopy?: () => void;
}

export function MessageActions({ content, onCopy }: MessageActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        type="button"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
