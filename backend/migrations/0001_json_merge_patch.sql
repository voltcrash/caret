-- RFC 7396 merge-patch semantics for nested live configuration updates.
CREATE FUNCTION jsonb_merge_patch(target jsonb, patch jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item record;
BEGIN
  IF jsonb_typeof(patch) <> 'object' THEN RETURN patch; END IF;
  IF jsonb_typeof(target) IS DISTINCT FROM 'object' THEN target := '{}'::jsonb; END IF;
  FOR item IN SELECT * FROM jsonb_each(patch) LOOP
    IF item.value = 'null'::jsonb THEN target := target - item.key;
    ELSE target := jsonb_set(target, ARRAY[item.key], jsonb_merge_patch(target -> item.key, item.value)); END IF;
  END LOOP;
  RETURN target;
END;
$$;
