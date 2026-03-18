import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

const hasRlsTestEnv =
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0 &&
  SUPABASE_SERVICE_ROLE_KEY.length > 0;

const describeRls = hasRlsTestEnv ? describe : describe.skip;

type TestIdentity = {
  userId: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

describeRls('supabase rls integration', () => {
  let adminClient: SupabaseClient;
  let userA: TestIdentity;
  let userB: TestIdentity;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    userA = await createTestIdentity(adminClient, 'rls-user-a');
    userB = await createTestIdentity(adminClient, 'rls-user-b');
  });

  afterAll(async () => {
    if (!adminClient) {
      return;
    }

    const userIds = [userA?.userId, userB?.userId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    if (userIds.length > 0) {
      await adminClient.from('chat_threads').delete().in('user_id', userIds);
      await adminClient.from('experiences').delete().in('user_id', userIds);
    }

    if (userA?.userId) {
      await adminClient.auth.admin.deleteUser(userA.userId);
    }

    if (userB?.userId) {
      await adminClient.auth.admin.deleteUser(userB.userId);
    }
  });

  it('enforces owner-only access for runtime and persistence tables', async () => {
    const threadAId = randomUUID();
    const experienceAId = randomUUID();

    const seededThread = await adminClient
      .from('chat_threads')
      .insert({
        id: threadAId,
        user_id: userA.userId,
        title: 'Owner thread',
      })
      .select('id')
      .single();
    expect(seededThread.error).toBeNull();

    const seededExperience = await adminClient
      .from('experiences')
      .insert({
        id: experienceAId,
        user_id: userA.userId,
        title: 'Owner experience',
      })
      .select('id')
      .single();
    expect(seededExperience.error).toBeNull();

    const ownThread = await userA.client
      .from('chat_threads')
      .select('id, user_id')
      .eq('id', threadAId)
      .maybeSingle();
    expect(ownThread.error).toBeNull();
    expect(ownThread.data?.id).toBe(threadAId);
    expect(ownThread.data?.user_id).toBe(userA.userId);

    const foreignThread = await userB.client
      .from('chat_threads')
      .select('id, user_id')
      .eq('id', threadAId)
      .maybeSingle();
    expect(foreignThread.error).toBeNull();
    expect(foreignThread.data).toBeNull();

    const ownExperience = await userA.client
      .from('experiences')
      .select('id, user_id')
      .eq('id', experienceAId)
      .maybeSingle();
    expect(ownExperience.error).toBeNull();
    expect(ownExperience.data?.id).toBe(experienceAId);
    expect(ownExperience.data?.user_id).toBe(userA.userId);

    const foreignExperience = await userB.client
      .from('experiences')
      .select('id, user_id')
      .eq('id', experienceAId)
      .maybeSingle();
    expect(foreignExperience.error).toBeNull();
    expect(foreignExperience.data).toBeNull();

    const forgedThreadInsert = await userB.client
      .from('chat_threads')
      .insert({
        user_id: userA.userId,
        title: 'Forged thread',
      })
      .select('id')
      .maybeSingle();
    expect(forgedThreadInsert.error).not.toBeNull();

    const forgedExperienceInsert = await userB.client
      .from('experiences')
      .insert({
        user_id: userA.userId,
        title: 'Forged experience',
      })
      .select('id')
      .maybeSingle();
    expect(forgedExperienceInsert.error).not.toBeNull();
  });
});

async function createTestIdentity(
  adminClient: SupabaseClient,
  prefix: string,
): Promise<TestIdentity> {
  const email = `${prefix}-${randomUUID()}@example.test`;
  const password = `Rls-${randomUUID()}!`;

  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? 'Failed to create test auth user.');
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const signedIn = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(signedIn.error?.message ?? 'Failed to sign in test auth user.');
  }

  return {
    userId: created.data.user.id,
    email,
    password,
    client,
  };
}
