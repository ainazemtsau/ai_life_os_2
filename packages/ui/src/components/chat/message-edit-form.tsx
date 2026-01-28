'use client';

import * as React from 'react';

interface MessageEditFormProps {
  initialContent: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

export function MessageEditForm({ initialContent, onSave, onCancel }: MessageEditFormProps) {
  const [value, setValue] = React.useState(initialContent);

  const handleSave = () => {
    if (value.length >= 1) {
      onSave(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={4}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
          type="button"
        >
          Save
        </button>
        <button onClick={onCancel} className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600" type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
