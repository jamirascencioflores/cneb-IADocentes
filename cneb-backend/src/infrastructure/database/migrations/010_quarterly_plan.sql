-- Rename the label everywhere, including historical before/after plan columns.
-- Balances, dates, ownership and movement amounts are preserved.
ALTER TYPE subscription_plan RENAME VALUE 'TRIMONTHLY' TO 'QUARTERLY';
