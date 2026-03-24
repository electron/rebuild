let cached: string | null | undefined;

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
