'use client';

import { useEffect, useRef } from 'react';

export interface UnreadIndicatorProps {
  isGenerating: boolean;
  originalTitle?: string;
}

export function UnreadIndicator({ isGenerating, originalTitle = 'AI Life OS' }: UnreadIndicatorProps) {
  const wasGeneratingRef = useRef(false);
  const originalTitleRef = useRef(originalTitle);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        document.title = originalTitleRef.current;
      }
    };

    if (wasGeneratingRef.current && !isGenerating && document.visibilityState === 'hidden') {
      document.title = `● ${originalTitleRef.current}`;
    }

    wasGeneratingRef.current = isGenerating;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isGenerating]);

  return null;
}
