'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';

export function ThumbsBar(input: {
  onFeedback: (kind: 'thumbs_up' | 'thumbs_down') => void;
}) {
  return (
    <div className="message-thumbs-bar" role="group" aria-label="Rate this reply">
      <button
        type="button"
        className="message-thumb-button"
        aria-label="Thumbs up"
        onClick={() => input.onFeedback('thumbs_up')}
      >
        <ThumbsUp size={16} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className="message-thumb-button"
        aria-label="Thumbs down"
        onClick={() => input.onFeedback('thumbs_down')}
      >
        <ThumbsDown size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
