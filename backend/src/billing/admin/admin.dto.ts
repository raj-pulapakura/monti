export type ManualCreditRequestDto = {
  userId: string;
  credits: number;
  reason: string;
  operatorNote?: string;
};

export type UserLedgerParamsDto = {
  userId: string;
};

export type UserLedgerQueryDto = {
  limit?: string;
};

export type WebhookReplayParamsDto = {
  eventId: string;
};

export type ManualCreditResultDto = {
  grantId?: string;
  availableCredits: number;
};

export type LedgerEntryDto = {
  id: string;
  entryType: string;
  creditsDelta: number;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  creditGrantId: string | null;
  stripeEventId: string | null;
};

export type ReconciliationSummaryRowDto = {
  month: string;
  qualityTier: 'fast' | 'quality' | 'unknown';
  creditsDebited: number;
  requestTokensIn: number;
  requestTokensOut: number;
  totalTokens: number;
  rowsIncluded: number;
};
