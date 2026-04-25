update public.pricing_rule_snapshots
set rules_json = jsonb_set(rules_json, '{topupCredits}', '300'::jsonb, true)
where version_key = 'launch-v2';
