import { ValidationError } from '../../common/errors/app-error';
import { parseStreamEventsRequestWithHeader } from './chat-runtime.dto';

describe('parseStreamEventsRequestWithHeader', () => {
  const threadId = '3ec42f7d-bf2f-4144-92fe-1f467f655dca';

  it('uses explicit cursor query when provided', () => {
    const parsed = parseStreamEventsRequestWithHeader(
      threadId,
      { cursor: '12' },
      '9',
    );

    expect(parsed).toEqual({
      threadId,
      cursor: '12',
    });
  });

  it('falls back to Last-Event-ID header when cursor query is omitted', () => {
    const parsed = parseStreamEventsRequestWithHeader(threadId, {}, '27');

    expect(parsed).toEqual({
      threadId,
      cursor: '27',
    });
  });

  it('rejects invalid thread ids', () => {
    expect(() =>
      parseStreamEventsRequestWithHeader('not-a-uuid', {}, '1'),
    ).toThrow(ValidationError);
  });
});
