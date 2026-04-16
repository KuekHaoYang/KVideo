/**
 * Parses a video title to extract quality tags (e.g., [HD], [TS])
 * and return a cleaned title.
 */
export function parseVideoTitle(title: string): { cleanTitle: string, quality?: string } {
    // Regex to match tags in brackets at the start of the title
    // Example: "[HD] 利刃出鞘3" -> quality: "HD", cleanTitle: "利刃出鞘3"
    // Example: "利刃出鞘3 [HD]" -> quality: "HD", cleanTitle: "利刃出鞘3"

    const bracketRegex = /\[([^\]]+)\]/g;
    let quality: string | undefined;
    let cleanTitle = title;

    const matches = [...title.matchAll(bracketRegex)];

    if (matches.length > 0) {
        // Take the first bracket content as quality (usually what we want)
        quality = matches[0][1];
        // Remove all brackets and their content from the title
        cleanTitle = title.replace(bracketRegex, '').trim();
    }

    return {
        cleanTitle: cleanTitle || title,
        quality
    };
}

/**
 * Numeric resolution keywords only.
 * Qualitative labels such as "蓝光" or "高清" are intentionally excluded because
 * they are not real numeric resolutions.
 */
const NUMERIC_RESOLUTION_PATTERNS: { pattern: RegExp; label: string; color: string }[] = [
    { pattern: /(?:^|[^\d])(4320p?|8k)(?:[^\d]|$)/i, label: '8K', color: 'bg-rose-500' },
    { pattern: /(?:^|[^\d])(2160p?|4k|uhd)(?:[^\d]|$)/i, label: '4K', color: 'bg-amber-500' },
    { pattern: /(?:^|[^\d])(1440p?|2k|qhd)(?:[^\d]|$)/i, label: '2K', color: 'bg-emerald-500' },
    { pattern: /(?:^|[^\d])(1080p?|1080i|full\s*hd|fhd)(?:[^\d]|$)/i, label: '1080P', color: 'bg-green-500' },
    { pattern: /(?:^|[^\d])720p?(?:[^\d]|$)|hd720/i, label: '720P', color: 'bg-teal-500' },
    { pattern: /(?:^|[^\d])540p?(?:[^\d]|$)/i, label: '540P', color: 'bg-cyan-500' },
    { pattern: /(?:^|[^\d])480p?(?:[^\d]|$)/i, label: '480P', color: 'bg-sky-500' },
    { pattern: /(?:^|[^\d])360p?(?:[^\d]|$)/i, label: '360P', color: 'bg-gray-500' },
    { pattern: /(?:^|[^\d])240p?(?:[^\d]|$)/i, label: '240P', color: 'bg-gray-500' },
    { pattern: /(?:^|[^\d])144p?(?:[^\d]|$)/i, label: '144P', color: 'bg-gray-500' },
];

/**
 * Extracts a numeric playback resolution from video remarks or title.
 * Non-numeric labels are intentionally ignored.
 */
export function extractNumericResolutionLabel(
    remarks?: string,
    quality?: string
): { label: string; color: string } | null {
    const text = `${remarks || ''} ${quality || ''}`;
    if (!text.trim()) return null;

    for (const { pattern, label, color } of NUMERIC_RESOLUTION_PATTERNS) {
        if (pattern.test(text)) {
            return { label, color };
        }
    }

    return null;
}

export function extractPlaybackQualityLabel(
    remarks?: string,
    quality?: string
): { label: string; color: string } | null {
    return extractNumericResolutionLabel(remarks, quality);
}

export function extractQualityLabel(remarks?: string, quality?: string): { label: string; color: string } | null {
    return extractNumericResolutionLabel(remarks, quality);
}
