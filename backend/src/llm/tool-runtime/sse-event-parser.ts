export interface ServerSentEventRecord {
  event: string | null;
  data: string;
}

export async function* parseServerSentEvents(
  response: Response,
): AsyncGenerator<ServerSentEventRecord> {
  if (!response.body) {
    throw new Error('Streaming response body was empty.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let eventName: string | null = null;
  let dataLines: string[] = [];

  const emitEvent = (): ServerSentEventRecord | null => {
    if (dataLines.length === 0) {
      eventName = null;
      return null;
    }

    const record: ServerSentEventRecord = {
      event: eventName,
      data: dataLines.join('\n'),
    };
    eventName = null;
    dataLines = [];
    return record;
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        break;
      }

      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (line.length === 0) {
        const record = emitEvent();
        if (record) {
          yield record;
        }
        continue;
      }

      if (line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim() || null;
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) {
    const trailingLine = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
    if (trailingLine.startsWith('data:')) {
      dataLines.push(trailingLine.slice('data:'.length).trimStart());
    } else if (trailingLine.startsWith('event:')) {
      eventName = trailingLine.slice('event:'.length).trim() || null;
    }
  }

  const finalRecord = emitEvent();
  if (finalRecord) {
    yield finalRecord;
  }
}
