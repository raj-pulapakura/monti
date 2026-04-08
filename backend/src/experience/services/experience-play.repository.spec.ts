import { ValidationError } from '../../common/errors/app-error';
import { ExperiencePlayRepository } from './experience-play.repository';

type QueryBuilder = {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  maybeSingle: jest.Mock;
};

function makeQueryBuilder(result: { data: unknown; error: unknown }): QueryBuilder {
  const builder: QueryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function makeClient(
  experienceResult: { data: unknown; error: unknown },
  versionResult: { data: unknown; error: unknown },
) {
  const experienceBuilder = makeQueryBuilder(experienceResult);
  const versionBuilder = makeQueryBuilder(versionResult);

  return {
    from: jest.fn((table: string) => {
      if (table === 'experiences') return experienceBuilder;
      if (table === 'experience_versions') return versionBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('ExperiencePlayRepository', () => {
  describe('findBySlug — no version number (latest)', () => {
    it('returns experience content for a valid slug', async () => {
      const client = makeClient(
        { data: { id: 'exp-1', latest_version_id: 'ver-1', title: 'Quiz' }, error: null },
        { data: { html: '<p>', css: 'body{}', js: 'var x=1' }, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      const result = await repo.findBySlug('my-quiz-abc123');
      expect(result).toEqual({ title: 'Quiz', html: '<p>', css: 'body{}', js: 'var x=1' });
    });

    it('returns null when slug not found', async () => {
      const client = makeClient(
        { data: null, error: null },
        { data: null, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      expect(await repo.findBySlug('unknown-slug')).toBeNull();
    });

    it('returns null when experience has no latest_version_id', async () => {
      const client = makeClient(
        { data: { id: 'exp-1', latest_version_id: null, title: 'Quiz' }, error: null },
        { data: null, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      expect(await repo.findBySlug('my-quiz-abc123')).toBeNull();
    });

    it('throws ValidationError for empty slug', async () => {
      const client = makeClient({ data: null, error: null }, { data: null, error: null });
      const repo = new ExperiencePlayRepository(client as never);
      await expect(repo.findBySlug('   ')).rejects.toThrow(ValidationError);
    });
  });

  describe('findBySlug — with version number', () => {
    it('returns content for the specified version number', async () => {
      const client = makeClient(
        { data: { id: 'exp-1', latest_version_id: 'ver-3', title: 'Quiz' }, error: null },
        { data: { html: '<div>', css: 'h1{}', js: '' }, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      const result = await repo.findBySlug('my-quiz-abc123', 2);
      expect(result).toEqual({ title: 'Quiz', html: '<div>', css: 'h1{}', js: '' });
    });

    it('returns null when the requested version number does not exist', async () => {
      const client = makeClient(
        { data: { id: 'exp-1', latest_version_id: 'ver-3' }, error: null },
        { data: null, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      expect(await repo.findBySlug('my-quiz-abc123', 99)).toBeNull();
    });

    it('returns null when the experience is not found (version number path)', async () => {
      const client = makeClient(
        { data: null, error: null },
        { data: null, error: null },
      );
      const repo = new ExperiencePlayRepository(client as never);
      expect(await repo.findBySlug('unknown-slug', 2)).toBeNull();
    });

    it('queries by experience_id and version_number when versionNumber is provided', async () => {
      const versionBuilder = makeQueryBuilder({
        data: { html: '', css: '', js: '' },
        error: null,
      });
      const client = {
        from: jest.fn((table: string) => {
          if (table === 'experiences') {
            return makeQueryBuilder({
              data: { id: 'exp-1', latest_version_id: 'ver-3', title: 'T' },
              error: null,
            });
          }
          return versionBuilder;
        }),
      };
      const repo = new ExperiencePlayRepository(client as never);
      await repo.findBySlug('my-quiz-abc123', 2);

      const eqCalls = versionBuilder.eq.mock.calls;
      expect(eqCalls).toContainEqual(['experience_id', 'exp-1']);
      expect(eqCalls).toContainEqual(['version_number', 2]);
    });

    it('does not query by latest_version_id when versionNumber is provided', async () => {
      const versionBuilder = makeQueryBuilder({
        data: { html: '', css: '', js: '' },
        error: null,
      });
      const client = {
        from: jest.fn((table: string) => {
          if (table === 'experiences') {
            return makeQueryBuilder({
              data: { id: 'exp-1', latest_version_id: 'ver-3', title: 'T' },
              error: null,
            });
          }
          return versionBuilder;
        }),
      };
      const repo = new ExperiencePlayRepository(client as never);
      await repo.findBySlug('my-quiz-abc123', 2);

      const eqCalls = versionBuilder.eq.mock.calls.map(([field]: [string]) => field);
      expect(eqCalls).not.toContain('id');
    });
  });
});
