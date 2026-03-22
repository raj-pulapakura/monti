import { ValidationError } from '../../common/errors/app-error';
import {
  parseListThreadsRequest,
  parseStreamEventsRequestWithHeader,
} from './chat-runtime.dto';

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

describe('parseListThreadsRequest', () => {
  it('uses default limit when omitted', () => {
    const parsed = parseListThreadsRequest({});

    expect(parsed.limit).toBe(1000);
  });

  it('accepts positive integer limit and caps to max', () => {
    expect(parseListThreadsRequest({ limit: '200' }).limit).toBe(200);
    expect(parseListThreadsRequest({ limit: '999999' }).limit).toBe(5000);
  });

  it('rejects invalid limit values', () => {
    expect(() => parseListThreadsRequest({ limit: 'abc' })).toThrow(ValidationError);
    expect(() => parseListThreadsRequest({ limit: 0 })).toThrow(ValidationError);
  });
});
