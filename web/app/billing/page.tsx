import { permanentRedirect } from 'next/navigation';

export default function BillingRedirectPage() {
  permanentRedirect('/settings/billing');
}
