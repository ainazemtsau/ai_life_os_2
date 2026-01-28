'use client';

import * as React from 'react';
import { Copy, Check, Pencil } from 'lucide-react';

interface MessageActionsProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId?: string;
  onCopy?: () => void;
  onEdit?: () => void;
}

export function MessageActions({ role, content, messageId, onCopy, onEdit }: MessageActionsProps) {
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
    <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      {role === 'user' && messageId && onEdit && (
        <button
          onClick={onEdit}
          className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
          type="button"
          title="Edit message"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={handleCopy}
        className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
        type="button"
        title={copied ? 'Copied!' : 'Copy message'}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
