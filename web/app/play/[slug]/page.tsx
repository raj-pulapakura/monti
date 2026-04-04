import type { Metadata } from 'next';
import { PlayClient } from './play-client';

const API_INTERNAL_URL = (
  process.env.API_INTERNAL_URL ?? 'http://localhost:3001'
).replace(/\/+$/, '');

async function fetchExperienceTitle(slug: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_INTERNAL_URL}/api/play/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { ok: true; data: { title: string } };
    return body.data.title;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = await fetchExperienceTitle(slug);
  return {
    title: title ? `${title} — Monti` : 'Experience — Monti',
  };
}

export default function PlayPage() {
  return <PlayClient />;
}
