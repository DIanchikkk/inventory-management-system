export function extractUuidFromScan(raw: string): string | null {
  const m = raw.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return m ? m[0].toLowerCase() : null;
}
