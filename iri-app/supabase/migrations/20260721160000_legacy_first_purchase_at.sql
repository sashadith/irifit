-- Session 10: Kaufdatum aus Digistore24 am Legacy-Datensatz (frühester Kauf)
alter table public.legacy_customers
  add column if not exists first_purchase_at timestamptz;
