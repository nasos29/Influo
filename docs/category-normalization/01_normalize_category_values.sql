-- Προαιρετικό backfill. Τρέξτε ΜΕΤΑ το deploy του PR.
-- Δεν προσθέτει στήλες. Ξαναγράφει μόνο γνωστά παλιά ονόματα σε canonical keys
-- μέσα σε influencers.category, brands.industry και brand_campaigns.category.
-- Πολλαπλές κατηγορίες μένουν comma-separated (χωρίς κενό).
-- Rollback: 99_rollback.sql (χρησιμοποιεί τον πίνακα backup που φτιάχνει αυτό το αρχείο).
--
-- Έλεγχος 11 Οκτ 2026: καμία αποθηκευμένη τιμή δεν χρειαζόταν αλλαγή.
-- Το script είναι idempotent και σε καθαρά δεδομένα δεν αλλάζει γραμμές.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '180s';

CREATE TABLE IF NOT EXISTS public.category_value_backup_20261011 (
  src text NOT NULL,
  row_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value text,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (src, row_id, column_name)
);

ALTER TABLE public.category_value_backup_20261011 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.category_value_backup_20261011 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_stored_categories(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
  part text;
  folded text;
  canon text;
  out_parts text[] := ARRAY[]::text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN raw;
  END IF;

  parts := regexp_split_to_array(raw, '\s*,\s*');
  FOREACH part IN ARRAY parts LOOP
    folded := lower(btrim(translate(part, 'άέήίόύώΆΈΉΊΌΎΏϊΐϋΰς', 'αεηιουωαεηιουωιιυυσ')));
    folded := regexp_replace(folded, '&', ' and ', 'g');
    folded := regexp_replace(folded, '[^a-z0-9α-ω ]', ' ', 'g');
    folded := btrim(regexp_replace(folded, '\s+', ' ', 'g'));

    canon := CASE folded
      WHEN 'γενικα' THEN 'Γενικά'
      WHEN 'general' THEN 'Γενικά'
      WHEN 'general all categories' THEN 'Γενικά'
      WHEN 'lifestyle' THEN 'Lifestyle'
      WHEN 'fashion' THEN 'Fashion & Style'
      WHEN 'fashion and style' THEN 'Fashion & Style'
      WHEN 'fashion style' THEN 'Fashion & Style'
      WHEN 'μοδα' THEN 'Fashion & Style'
      WHEN 'μοδα and στυλ' THEN 'Fashion & Style'
      WHEN 'μοδα και στυλ' THEN 'Fashion & Style'
      WHEN 'στυλ' THEN 'Fashion & Style'
      WHEN 'beauty' THEN 'Beauty & Makeup'
      WHEN 'makeup' THEN 'Beauty & Makeup'
      WHEN 'make up' THEN 'Beauty & Makeup'
      WHEN 'beauty makeup' THEN 'Beauty & Makeup'
      WHEN 'beauty and makeup' THEN 'Beauty & Makeup'
      WHEN 'beauty and make up' THEN 'Beauty & Makeup'
      WHEN 'ομορφια' THEN 'Beauty & Makeup'
      WHEN 'μακιγιαζ' THEN 'Beauty & Makeup'
      WHEN 'ομορφια and μακιγιαζ' THEN 'Beauty & Makeup'
      WHEN 'ομορφια και μακιγιαζ' THEN 'Beauty & Makeup'
      WHEN 'travel' THEN 'Travel'
      WHEN 'ταξιδια' THEN 'Travel'
      WHEN 'food' THEN 'Food & Drink'
      WHEN 'food and drink' THEN 'Food & Drink'
      WHEN 'food drink' THEN 'Food & Drink'
      WHEN 'φαγητο' THEN 'Food & Drink'
      WHEN 'φαγητο and ποτα' THEN 'Food & Drink'
      WHEN 'φαγητο και ποτα' THEN 'Food & Drink'
      WHEN 'fitness' THEN 'Health & Fitness'
      WHEN 'health' THEN 'Health & Fitness'
      WHEN 'health and fitness' THEN 'Health & Fitness'
      WHEN 'health fitness' THEN 'Health & Fitness'
      WHEN 'υγεια' THEN 'Health & Fitness'
      WHEN 'υγεια and fitness' THEN 'Health & Fitness'
      WHEN 'υγεια και fitness' THEN 'Health & Fitness'
      WHEN 'tech' THEN 'Tech & Gadgets'
      WHEN 'technology' THEN 'Tech & Gadgets'
      WHEN 'gadgets' THEN 'Tech & Gadgets'
      WHEN 'tech and gadgets' THEN 'Tech & Gadgets'
      WHEN 'tech gadgets' THEN 'Tech & Gadgets'
      WHEN 'τεχνολογια' THEN 'Tech & Gadgets'
      WHEN 'τεχνολογια and gadgets' THEN 'Tech & Gadgets'
      WHEN 'τεχνολογια και gadgets' THEN 'Tech & Gadgets'
      WHEN 'business' THEN 'Business & Finance'
      WHEN 'finance' THEN 'Business & Finance'
      WHEN 'business and finance' THEN 'Business & Finance'
      WHEN 'business finance' THEN 'Business & Finance'
      WHEN 'επιχειρησεις' THEN 'Business & Finance'
      WHEN 'οικονομικα' THEN 'Business & Finance'
      WHEN 'επιχειρησεις and οικονομικα' THEN 'Business & Finance'
      WHEN 'επιχειρησεις και οικονομικα' THEN 'Business & Finance'
      WHEN 'gaming' THEN 'Gaming & Esports'
      WHEN 'esports' THEN 'Gaming & Esports'
      WHEN 'gaming and esports' THEN 'Gaming & Esports'
      WHEN 'gaming esports' THEN 'Gaming & Esports'
      WHEN 'parenting' THEN 'Parenting & Family'
      WHEN 'family' THEN 'Parenting & Family'
      WHEN 'parenting and family' THEN 'Parenting & Family'
      WHEN 'οικογενεια' THEN 'Parenting & Family'
      WHEN 'οικογενεια and παιδια' THEN 'Parenting & Family'
      WHEN 'οικογενεια και παιδια' THEN 'Parenting & Family'
      WHEN 'home' THEN 'Home & Decor'
      WHEN 'decor' THEN 'Home & Decor'
      WHEN 'home and decor' THEN 'Home & Decor'
      WHEN 'home decor' THEN 'Home & Decor'
      WHEN 'σπιτι' THEN 'Home & Decor'
      WHEN 'διακοσμηση' THEN 'Home & Decor'
      WHEN 'σπιτι and διακοσμηση' THEN 'Home & Decor'
      WHEN 'σπιτι και διακοσμηση' THEN 'Home & Decor'
      WHEN 'pets' THEN 'Pets & Animals'
      WHEN 'animals' THEN 'Pets & Animals'
      WHEN 'pets and animals' THEN 'Pets & Animals'
      WHEN 'κατοικιδια' THEN 'Pets & Animals'
      WHEN 'κατοικιδια and ζωα' THEN 'Pets & Animals'
      WHEN 'κατοικιδια και ζωα' THEN 'Pets & Animals'
      WHEN 'comedy' THEN 'Comedy & Entertainment'
      WHEN 'entertainment' THEN 'Comedy & Entertainment'
      WHEN 'comedy and entertainment' THEN 'Comedy & Entertainment'
      WHEN 'κωμωδια' THEN 'Comedy & Entertainment'
      WHEN 'ψυχαγωγια' THEN 'Comedy & Entertainment'
      WHEN 'κωμωδια and ψυχαγωγια' THEN 'Comedy & Entertainment'
      WHEN 'κωμωδια και ψυχαγωγια' THEN 'Comedy & Entertainment'
      WHEN 'art' THEN 'Art & Photography'
      WHEN 'photography' THEN 'Art & Photography'
      WHEN 'art and photography' THEN 'Art & Photography'
      WHEN 'τεχνη' THEN 'Art & Photography'
      WHEN 'φωτογραφια' THEN 'Art & Photography'
      WHEN 'τεχνη and φωτογραφια' THEN 'Art & Photography'
      WHEN 'τεχνη και φωτογραφια' THEN 'Art & Photography'
      WHEN 'music' THEN 'Music & Dance'
      WHEN 'dance' THEN 'Music & Dance'
      WHEN 'music and dance' THEN 'Music & Dance'
      WHEN 'μουσικη' THEN 'Music & Dance'
      WHEN 'χορος' THEN 'Music & Dance'
      WHEN 'μουσικη and χορος' THEN 'Music & Dance'
      WHEN 'μουσικη και χορος' THEN 'Music & Dance'
      WHEN 'education' THEN 'Education & Coaching'
      WHEN 'coaching' THEN 'Education & Coaching'
      WHEN 'education and coaching' THEN 'Education & Coaching'
      WHEN 'εκπαιδευση' THEN 'Education & Coaching'
      WHEN 'εκπαιδευση and coaching' THEN 'Education & Coaching'
      WHEN 'εκπαιδευση και coaching' THEN 'Education & Coaching'
      WHEN 'sports' THEN 'Sports & Athletes'
      WHEN 'athletes' THEN 'Sports & Athletes'
      WHEN 'sports and athletes' THEN 'Sports & Athletes'
      WHEN 'αθληματα' THEN 'Sports & Athletes'
      WHEN 'αθλητες' THEN 'Sports & Athletes'
      WHEN 'αθληματα and αθλητες' THEN 'Sports & Athletes'
      WHEN 'αθληματα και αθλητες' THEN 'Sports & Athletes'
      WHEN 'diy' THEN 'DIY & Crafts'
      WHEN 'crafts' THEN 'DIY & Crafts'
      WHEN 'diy and crafts' THEN 'DIY & Crafts'
      WHEN 'χειροτεχνιες' THEN 'DIY & Crafts'
      WHEN 'diy and χειροτεχνιες' THEN 'DIY & Crafts'
      WHEN 'diy και χειροτεχνιες' THEN 'DIY & Crafts'
      WHEN 'sustainability' THEN 'Sustainability & Eco'
      WHEN 'eco' THEN 'Sustainability & Eco'
      WHEN 'sustainability and eco' THEN 'Sustainability & Eco'
      WHEN 'βιωσιμοτητα' THEN 'Sustainability & Eco'
      WHEN 'οικολογια' THEN 'Sustainability & Eco'
      WHEN 'βιωσιμοτητα and οικολογια' THEN 'Sustainability & Eco'
      WHEN 'βιωσιμοτητα και οικολογια' THEN 'Sustainability & Eco'
      WHEN 'cars' THEN 'Cars & Automotive'
      WHEN 'automotive' THEN 'Cars & Automotive'
      WHEN 'cars and automotive' THEN 'Cars & Automotive'
      WHEN 'αυτοκινητα' THEN 'Cars & Automotive'
      WHEN 'unboxing' THEN 'Unboxing'
      ELSE NULL
    END;

    IF canon IS NULL THEN
      IF btrim(part) IN (
        'Γενικά','Lifestyle','Fashion & Style','Beauty & Makeup','Travel','Food & Drink',
        'Health & Fitness','Tech & Gadgets','Business & Finance','Gaming & Esports',
        'Parenting & Family','Home & Decor','Pets & Animals','Comedy & Entertainment',
        'Art & Photography','Music & Dance','Education & Coaching','Sports & Athletes',
        'DIY & Crafts','Sustainability & Eco','Cars & Automotive','Unboxing'
      ) THEN
        canon := btrim(part);
      ELSE
        canon := btrim(part);
      END IF;
    END IF;

    IF canon <> '' AND NOT canon = ANY(out_parts) THEN
      out_parts := array_append(out_parts, canon);
    END IF;
  END LOOP;

  RETURN array_to_string(out_parts, ',');
END;
$$;

INSERT INTO public.category_value_backup_20261011 (src, row_id, column_name, old_value)
SELECT 'influencers', id, 'category', category
FROM public.influencers
WHERE category IS NOT NULL
  AND category IS DISTINCT FROM public.normalize_stored_categories(category)
ON CONFLICT DO NOTHING;

INSERT INTO public.category_value_backup_20261011 (src, row_id, column_name, old_value)
SELECT 'brands', id, 'industry', industry
FROM public.brands
WHERE industry IS NOT NULL
  AND industry IS DISTINCT FROM public.normalize_stored_categories(industry)
ON CONFLICT DO NOTHING;

INSERT INTO public.category_value_backup_20261011 (src, row_id, column_name, old_value)
SELECT 'brand_campaigns', id, 'category', category
FROM public.brand_campaigns
WHERE category IS NOT NULL
  AND category IS DISTINCT FROM public.normalize_stored_categories(category)
ON CONFLICT DO NOTHING;

UPDATE public.influencers i
SET category = public.normalize_stored_categories(i.category)
FROM public.category_value_backup_20261011 b
WHERE b.src = 'influencers'
  AND b.column_name = 'category'
  AND b.row_id = i.id
  AND i.category IS DISTINCT FROM public.normalize_stored_categories(i.category);

UPDATE public.brands br
SET industry = public.normalize_stored_categories(br.industry)
FROM public.category_value_backup_20261011 b
WHERE b.src = 'brands'
  AND b.column_name = 'industry'
  AND b.row_id = br.id
  AND br.industry IS DISTINCT FROM public.normalize_stored_categories(br.industry);

UPDATE public.brand_campaigns c
SET category = public.normalize_stored_categories(c.category)
FROM public.category_value_backup_20261011 b
WHERE b.src = 'brand_campaigns'
  AND b.column_name = 'category'
  AND b.row_id = c.id
  AND c.category IS DISTINCT FROM public.normalize_stored_categories(c.category);

DROP FUNCTION public.normalize_stored_categories(text);

COMMIT;
