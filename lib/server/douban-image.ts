// Douban's imgN.doubanio.com hosts mirror the same paths but use different
// network routes. Some routes are unreachable from overseas deployments, so a
// failed request can retry the same path through known reachable mirrors.
const DOUBAN_IMAGE_HOSTS = [
  'img9.doubanio.com',
  'img3.doubanio.com',
  'img2.doubanio.com',
];

export function buildDoubanImageCandidates(rawUrl: string): string[] {
  const candidates = [rawUrl];

  try {
    const parsed = new URL(rawUrl);
    if (!/^img\d+\.doubanio\.com$/.test(parsed.hostname)) {
      return candidates;
    }

    for (const host of DOUBAN_IMAGE_HOSTS) {
      if (host === parsed.hostname) continue;
      const alternate = new URL(parsed.toString());
      alternate.hostname = host;
      candidates.push(alternate.toString());
    }
  } catch {
    // Leave malformed URLs to fetch so the route returns its normal proxy error.
  }

  return candidates;
}
