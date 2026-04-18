import { ValidationError } from '../../common/errors/app-error';
import {
  parseCancelRunRequest,
  parseListThreadsRequest,
  parseRefinementSuggestionsRequest,
  parseStreamEventsRequestWithHeader,
  parseUpdateExperienceTitleRequest,
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

describe('parseRefinementSuggestionsRequest', () => {
  const threadId = '3ec42f7d-bf2f-4144-92fe-1f467f655dca';
  const versionId = 'a1b2c3d4-0000-4000-8000-000000000001';

  it('parses valid threadId and experienceVersionId', () => {
    const parsed = parseRefinementSuggestionsRequest(threadId, {
      experienceVersionId: versionId,
    });

    expect(parsed).toEqual({ threadId, experienceVersionId: versionId });
  });

  it('rejects non-UUID threadId', () => {
    expect(() =>
      parseRefinementSuggestionsRequest('not-a-uuid', { experienceVersionId: versionId }),
    ).toThrow(ValidationError);
  });

  it('rejects non-UUID experienceVersionId', () => {
    expect(() =>
      parseRefinementSuggestionsRequest(threadId, { experienceVersionId: 'not-a-uuid' }),
    ).toThrow(ValidationError);
  });

  it('rejects missing experienceVersionId', () => {
    expect(() =>
      parseRefinementSuggestionsRequest(threadId, {}),
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

describe('parseUpdateExperienceTitleRequest', () => {
  it('parses a valid non-empty title', () => {
    expect(parseUpdateExperienceTitleRequest({ title: 'My Title' })).toEqual({
      title: 'My Title',
    });
  });

  it('rejects missing title', () => {
    expect(() => parseUpdateExperienceTitleRequest({})).toThrow(ValidationError);
  });

  it('rejects empty title', () => {
    expect(() => parseUpdateExperienceTitleRequest({ title: '   ' })).toThrow(
      ValidationError,
    );
  });
});

describe('parseCancelRunRequest', () => {
  const threadId = '3ec42f7d-bf2f-4144-92fe-1f467f655dca';
  const runId = 'a1b2c3d4-0000-4000-8000-000000000002';

  it('parses valid threadId and runId', () => {
    expect(parseCancelRunRequest(threadId, runId)).toEqual({ threadId, runId });
  });

  it('rejects invalid threadId', () => {
    expect(() => parseCancelRunRequest('not-a-uuid', runId)).toThrow(ValidationError);
  });

  it('rejects invalid runId', () => {
    expect(() => parseCancelRunRequest(threadId, 'not-a-uuid')).toThrow(ValidationError);
  });
});
