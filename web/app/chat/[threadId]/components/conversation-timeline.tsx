'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, AssistantRun } from '../../../runtime-state';
import { toErrorMessage } from '@/lib/errors';
import { MessageFeedbackModal } from './message-feedback-modal';
import { ThumbsBar } from './thumbs-bar';

type ConversationTimelineItem =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'draft'; key: string; content: string };

const BUILD_MESSAGES = [
  'Building experience...',
  'Wiring up interactions...',
  'Crafting the layout...',
  'Polishing the details...',
];

const BUILD_MESSAGE_ROTATION_MS = 7000;

const THUMB_FEEDBACK_COPY = {
  thumbs_up: {
    title: 'Give positive feedback',
    detailsPlaceholder: 'What was satisfying about this response?',
  },
  thumbs_down: {
    title: 'What could be better about this response?',
    detailsPlaceholder: 'What was unsatisfying about this response?',
  },
} as const;

export function ConversationTimeline(input: {
  items: ConversationTimelineItem[];
  activeRunStatus: AssistantRun['status'] | null;
  showThinkingIndicator: boolean;
  showBuildIndicator: boolean;
  onMessageFeedback?: (
    messageId: string,
    kind: 'thumbs_up' | 'thumbs_down',
    message: string | null,
  ) => void | Promise<void>;
}) {
  const [buildMsgIndex, setBuildMsgIndex] = useState(0);

  useEffect(() => {
    if (!input.showBuildIndicator) {
      setBuildMsgIndex(0);
      return;
    }
    const id = setInterval(
      () => setBuildMsgIndex((i) => (i + 1) % BUILD_MESSAGES.length),
      BUILD_MESSAGE_ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [input.showBuildIndicator]);

  const [pending, setPending] = useState<{
    messageId: string;
    kind: 'thumbs_up' | 'thumbs_down';
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);

  const handleModalSubmit = useCallback(
    async (message: string | null) => {
      if (!pending || !input.onMessageFeedback) {
        return;
      }
      setSubmitPending(true);
      setModalError(null);
      try {
        await input.onMessageFeedback(pending.messageId, pending.kind, message);
        setPending(null);
      } catch (err) {
        setModalError(toErrorMessage(err));
      } finally {
        setSubmitPending(false);
      }
    },
    [pending, input.onMessageFeedback],
  );

  return (
    <>
      {input.items.map((item) =>
        item.kind === 'message' ? (
          <article
            key={item.key}
            className={`message-row ${item.message.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            {item.message.role === 'assistant' ? (
              <div className="message-assistant-stack">
                <p className="message-content">{item.message.content}</p>
                {input.onMessageFeedback ? (
                  <ThumbsBar
                    onFeedback={(kind) => {
                      setModalError(null);
                      setPending({ messageId: item.message.id, kind });
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <p className="message-content">{item.message.content}</p>
            )}
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
      {input.showThinkingIndicator ? (
        <article className="message-row message-assistant message-status">
          <p className="chat-build-indicator" role="status" aria-live="polite">
            <span className="chat-build-indicator-text">Thinking...</span>
          </p>
        </article>
      ) : null}
      {input.showBuildIndicator ? (
        <article className="message-row message-assistant message-status">
          <p className="chat-build-indicator" role="status" aria-live="polite">
            <span className="chat-build-indicator-text">{BUILD_MESSAGES[buildMsgIndex]}</span>
          </p>
        </article>
      ) : null}
      {pending && input.onMessageFeedback ? (
        <MessageFeedbackModal
          key={`${pending.messageId}-${pending.kind}`}
          title={THUMB_FEEDBACK_COPY[pending.kind].title}
          detailsPlaceholder={THUMB_FEEDBACK_COPY[pending.kind].detailsPlaceholder}
          onDismiss={() => {
            setPending(null);
            setModalError(null);
          }}
          onSubmit={handleModalSubmit}
          error={modalError}
          submitPending={submitPending}
        />
      ) : null}
    </>
  );
}
