import type { Metadata } from 'next';
import { playDemoLabel } from '@/app/components/marketing-landing/constants';
import { isPublicPlayDemoSlug } from '@/lib/public-play-demos';
import { PlayDemoClient } from './play-demo-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ demoSlug: string }>;
}): Promise<Metadata> {
  const { demoSlug } = await params;
  if (!isPublicPlayDemoSlug(demoSlug)) {
    return { title: 'Experience — Monti' };
  }
  const label = playDemoLabel(demoSlug);
  return {
    title: `${label} — Monti`,
  };
}

export default function PlayDemoPage() {
  return <PlayDemoClient />;
}
