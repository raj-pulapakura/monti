'use client';

import type { ChatMessage, AssistantRun } from '../../../runtime-state';

type ConversationTimelineItem =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'draft'; key: string; content: string };

export function ConversationTimeline(input: {
  items: ConversationTimelineItem[];
  activeRunStatus: AssistantRun['status'] | null;
  showBuildIndicator: boolean;
}) {
  return (
    <>
      {input.items.map((item) =>
        item.kind === 'message' ? (
          <article
            key={item.key}
            className={`message-row ${item.message.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            <p className="message-content">{item.message.content}</p>
          </article>
        ) : (
          <article key={item.key} className="message-row message-assistant">
            <p className="message-content">
              {item.content}
              {input.activeRunStatus === 'failed' ? null : (
                <span className="draft-cursor" aria-hidden="true" />
              )}
            </p>
          </article>
        ),
      )}
      {input.showBuildIndicator ? (
        <article className="message-row message-assistant message-status">
          <p className="chat-build-indicator" role="status" aria-live="polite">
            <span className="chat-build-indicator-text">Building experience...</span>
          </p>
        </article>
      ) : null}
    </>
  );
}
