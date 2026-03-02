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
 * Quality keywords and their display labels, ordered by priority (highest first).
 */
const QUALITY_PATTERNS: { pattern: RegExp; label: string; color: string }[] = [
    { pattern: /4k|2160p|uhd/i, label: '4K', color: 'bg-amber-500' },
    { pattern: /蓝光|藍光|bluray|blu-ray|remux/i, label: '蓝光', color: 'bg-blue-500' },
    { pattern: /1080p|1080i|full\s*hd|fhd/i, label: '1080P', color: 'bg-green-500' },
    { pattern: /超清|超高清/i, label: '超清', color: 'bg-green-500' },
    { pattern: /720p|hd720/i, label: '720P', color: 'bg-teal-500' },
    { pattern: /\bhd\b|高清|hdr/i, label: 'HD', color: 'bg-teal-500' },
    { pattern: /web-?dl|webrip/i, label: 'WEB-DL', color: 'bg-indigo-500' },
    { pattern: /hdtv/i, label: 'HDTV', color: 'bg-teal-500' },
    { pattern: /dvd|dvdrip/i, label: 'DVD', color: 'bg-purple-500' },
    { pattern: /抢先|枪版|ts版|ts\b|cam\b|hdts|预告/i, label: 'TS', color: 'bg-orange-500' },
    { pattern: /标清|sd\b/i, label: 'SD', color: 'bg-gray-500' },
    { pattern: /杜比|dolby|atmos/i, label: '杜比', color: 'bg-violet-500' },
    { pattern: /国语|普通话|mandarin/i, label: '国语', color: 'bg-sky-500' },
    { pattern: /粤语|cantonese/i, label: '粤语', color: 'bg-sky-500' },
    { pattern: /中[文字]字幕|中字|双语字幕/i, label: '中字', color: 'bg-cyan-500' },
];

/**
 * Extracts quality label from video remarks or title.
 * Returns the quality label and its associated color class.
 */
export function extractQualityLabel(remarks?: string, quality?: string): { label: string; color: string } | null {
    const text = `${remarks || ''} ${quality || ''}`;
    if (!text.trim()) return null;

    for (const { pattern, label, color } of QUALITY_PATTERNS) {
        if (pattern.test(text)) {
            return { label, color };
        }
    }

    return null;
}
