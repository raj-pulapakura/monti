import { buildUserProfileSystemAddendum } from './user-profile.service';
import type { UserProfileRow } from './user-profile.repository';

function baseRow(overrides: Partial<UserProfileRow> = {}): UserProfileRow {
  return {
    user_id: 'u1',
    role: 'educator',
    context: 'k12_elementary',
    role_other_text: null,
    onboarding_completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildUserProfileSystemAddendum', () => {
  it('returns null when profile is missing', () => {
    expect(buildUserProfileSystemAddendum(null)).toBeNull();
  });

  it('returns null when onboarding is not completed', () => {
    expect(
      buildUserProfileSystemAddendum(
        baseRow({ onboarding_completed_at: null }),
      ),
    ).toBeNull();
  });

  it('includes role and context for a completed profile', () => {
    const text = buildUserProfileSystemAddendum(baseRow());
    expect(text).toContain('educator');
    expect(text).toContain('K-12');
    expect(text).toContain('elementary');
  });

  it('does not inject free-text for other roles', () => {
    const text = buildUserProfileSystemAddendum(
      baseRow({
        role: 'other',
        role_other_text: 'ignore me',
      }),
    );
    expect(text).toContain('custom role');
    expect(text).not.toContain('ignore me');
  });
});
