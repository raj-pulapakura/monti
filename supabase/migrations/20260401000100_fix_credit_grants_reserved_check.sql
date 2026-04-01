-- The original check (remaining_credits + reserved_credits <= granted_credits) is
-- incompatible with the reservation RPC model, where remaining_credits represents
-- the total unspent balance (including in-flight reservations) and reserved_credits
-- is a subset of remaining_credits. The correct invariant is reserved <= remaining.

alter table public.credit_grants
  drop constraint if exists credit_grants_check;

alter table public.credit_grants
  add constraint credit_grants_reserved_lte_remaining
  check (reserved_credits <= remaining_credits);
