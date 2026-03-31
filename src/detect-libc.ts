let cached: string | null | undefined;

/**
 * Detects the libc family on the current Linux host via `process.report`.
 *
 * Used to resolve the `{libc}` token in prebuilt binary path templates.
 *
 * @returns `'glibc'` | `'musl'` | `null` (non-Linux or unable to detect)
 */
export function detectLibcFamily(): string | null {
  if (cached !== undefined) return cached;
  if (process.platform !== 'linux') return (cached = null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: any = process.report?.getReport();
  if (report?.header?.glibcVersionRuntime) return (cached = 'glibc');
  if (Array.isArray(report?.sharedObjects) && report.sharedObjects.some((s: string) => s.includes('libc.musl') || s.includes('ld-musl'))) {
    return (cached = 'musl');
  }
  return (cached = null);
}
