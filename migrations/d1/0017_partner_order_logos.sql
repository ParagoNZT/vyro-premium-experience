ALTER TABLE partner_orders ADD COLUMN logo_png TEXT
CHECK (logo_png IS NULL OR (kind = 'app' AND length(logo_png) BETWEEN 60 AND 1420000));
