type AssistantTextSnapshotCallback =
  | ((text: string) => void | Promise<void>)
  | undefined;

export function createAssistantTextSnapshotEmitter(
  onSnapshot: AssistantTextSnapshotCallback,
  options?: {
    minCharsBetweenSnapshots?: number;
  },
) {
  const minCharsBetweenSnapshots = Math.max(
    1,
    options?.minCharsBetweenSnapshots ?? 24,
  );

  let assistantText = '';
  let lastPublishedText = '';

  async function maybePublish(force = false): Promise<void> {
    if (!onSnapshot) {
      return;
    }

    if (assistantText === lastPublishedText) {
      return;
    }

    const charsSinceLastPublish = assistantText.length - lastPublishedText.length;
    const shouldPublish =
      force ||
      lastPublishedText.length === 0 ||
      charsSinceLastPublish >= minCharsBetweenSnapshots ||
      /[\n.!?]$/.test(assistantText);

    if (!shouldPublish) {
      return;
    }

    lastPublishedText = assistantText;
    await onSnapshot(assistantText);
  }

  return {
    getText(): string {
      return assistantText;
    },
    async append(delta: string | undefined): Promise<void> {
      if (!delta) {
        return;
      }

      assistantText += delta;
      await maybePublish();
    },
    async replace(text: string | undefined, force = false): Promise<void> {
      if (typeof text !== 'string' || text.length === 0) {
        return;
      }

      assistantText = text;
      await maybePublish(force);
    },
    async flush(): Promise<void> {
      await maybePublish(true);
    },
  };
}
