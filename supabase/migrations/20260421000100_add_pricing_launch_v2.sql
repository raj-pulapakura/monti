insert into public.pricing_rule_snapshots (version_key, rules_json)
values (
  'launch-v2',
  jsonb_build_object(
    'freeMonthlyCredits', 200,
    'paidMonthlyCredits', 1000,
    'fastCredits', 1,
    'qualityCredits', 5,
    'topupCredits', 50,
    'topupPriceUsd', 4,
    'paidPlanPriceUsd', 10
  )
)
on conflict (version_key) do nothing;
