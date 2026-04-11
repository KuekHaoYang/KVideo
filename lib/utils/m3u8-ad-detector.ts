/**
 * Heuristic Ad Detection Module
 * 
 * Provides block-based analysis for detecting ads in M3U8 playlists
 * using filename pattern matching and other heuristics.
 */

// Ad-related path keywords for scoring
export const AD_PATH_KEYWORDS = [
    'advert', 'preroll', 'midroll', 'postroll',
    'dai', 'vast', 'ima', 'adjump', 'commercial', 'sponsor'
];

/**
 * Represents a segment in the playlist
 */
interface Segment {
    url: string;
    duration: number;
    lineIndex: number;
}

/**
 * Represents a block of segments between DISCONTINUITY markers
 */
interface Block {
    segments: Segment[];
    startLineIndex: number;
    endLineIndex: number;
    hasCueTag: boolean;
}

/**
 * Pattern extracted from main content for comparison
 */
interface MainPattern {
    filenameRegex: RegExp | null;
    avgDuration: number;
    commonPrefix: string;
    pathPrefix: string; // Directory path prefix (e.g., "/20230907/73PWifvT/1392kb/hls/")
}

/**
 * Parse M3U8 content into blocks separated by DISCONTINUITY markers
 */
export function parseBlocks(lines: string[]): Block[] {
    const blocks: Block[] = [];
    let currentBlock: Block = {
        segments: [],
        startLineIndex: 0,
        endLineIndex: 0,
        hasCueTag: false
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for CUE tags
        if (line.startsWith('#EXT-X-CUE-OUT') || line.startsWith('#EXT-X-CUE-IN')) {
            currentBlock.hasCueTag = true;
        }

        // DISCONTINUITY marks block boundary
        if (line === '#EXT-X-DISCONTINUITY') {
            if (currentBlock.segments.length > 0) {
                currentBlock.endLineIndex = i - 1;
                blocks.push(currentBlock);
            }
            currentBlock = {
                segments: [],
                startLineIndex: i + 1,
                endLineIndex: 0,
                hasCueTag: false
            };
            continue;
        }

        // Parse EXTINF and the following URL
        if (line.startsWith('#EXTINF:')) {
            const durationMatch = line.match(/#EXTINF:([\d.]+)/);
            const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

            // Next line should be the URL
            if (i + 1 < lines.length) {
                const url = lines[i + 1].trim();
                if (url && !url.startsWith('#')) {
                    currentBlock.segments.push({
                        url,
                        duration,
                        lineIndex: i + 1
                    });
                }
            }
        }
    }

    // Don't forget the last block
    if (currentBlock.segments.length > 0) {
        currentBlock.endLineIndex = lines.length - 1;
        blocks.push(currentBlock);
    }

    return blocks;
}

/**
 * Unwrap proxied URL to get original URL
 */
function unwrapProxyUrl(url: string): string {
    if (url.includes('/api/proxy?url=')) {
        try {
            const match = url.match(/[?&]url=([^&]+)/);
            if (match && match[1]) {
                return decodeURIComponent(match[1]);
            }
        } catch {
            return url;
        }
    }
    return url;
}

/**
 * Extract filename from URL (handles both relative and absolute URLs)
 */
function extractFilename(url: string): string {
    try {
        const unwrappedUrl = unwrapProxyUrl(url);
        const path = unwrappedUrl.includes('://') ? new URL(unwrappedUrl).pathname : unwrappedUrl;
        const parts = path.split('/');
        return parts[parts.length - 1] || '';
    } catch {
        return url.split('/').pop() || '';
    }
}

/**
 * Find common prefix among an array of strings
 */
function findCommonPrefix(strings: string[]): string {
    if (!strings || strings.length < 2) return '';

    let prefix = '';
    const first = strings[0];

    for (let i = 0; i < first.length; i++) {
        const char = first[i];
        if (strings.every(s => s[i] === char)) {
            prefix += char;
        } else {
            break;
        }
    }

    return prefix;
}

/**
 * Extract path prefix (directory) from URL
 * e.g., "/20230907/73PWifvT/1392kb/hls/" from "/20230907/73PWifvT/1392kb/hls/gFE6lwIk.ts"
 */
function extractPathPrefix(url: string): string {
    try {
        const unwrappedUrl = unwrapProxyUrl(url);
        const path = unwrappedUrl.includes('://') ? new URL(unwrappedUrl).pathname : unwrappedUrl;
        const lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '';
    } catch {
        const lastSlash = url.lastIndexOf('/');
        return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : '';
    }
}

/**
 * Learn pattern from the largest block (assumed to be main content)
 */
export function learnMainPattern(blocks: Block[]): MainPattern {
    // Find the largest block by segment count (likely main content)
    const mainBlock = blocks.length > 0 ? blocks.reduce((largest, block) =>
        block.segments.length > largest.segments.length ? block : largest
    ) : null;

    if (!mainBlock || mainBlock.segments.length === 0) {
        return { filenameRegex: null, avgDuration: 0, commonPrefix: '', pathPrefix: '' };
    }

    // Extract filenames
    const filenames = mainBlock.segments.map(s => extractFilename(s.url));

    // Find common prefix
    const commonPrefix = findCommonPrefix(filenames);

    // Calculate average duration
    const totalDuration = mainBlock.segments.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = totalDuration / mainBlock.segments.length;

    // Try to build a regex pattern from the filenames
    // Common patterns: "0000001.ts", "seg-1.ts", "segment_001.ts"
    let filenameRegex: RegExp | null = null;
    if (commonPrefix.length >= 2) {
        // Escape special regex characters in prefix
        const escapedPrefix = commonPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filenameRegex = new RegExp(`^${escapedPrefix}`);
    }

    // Extract path prefix (directory path without filename)
    // e.g., "/20230907/73PWifvT/1392kb/hls/" from "/20230907/73PWifvT/1392kb/hls/gFE6lwIk.ts"
    const firstUrl = mainBlock.segments[0].url;
    const pathPrefix = extractPathPrefix(firstUrl);

    return { filenameRegex, avgDuration, commonPrefix, pathPrefix };
}

/**
 * Score a block for ad likelihood based on heuristics
 * Returns a score where higher = more likely to be an ad
 */
export function scoreBlock(block: Block, mainPattern: MainPattern, extraKeywords: string[] = []): number {
    let score = 0;

    // If block has CUE tag, it's definitely an ad
    if (block.hasCueTag) {
        return 10; // Max score
    }

    // Check path keywords (Built-in + Custom)
    // We filter out very short custom keywords to avoid false positives in scoring
    const safeExtraKeywords = extraKeywords.filter(k => k.length > 2);
    const allKeywords = [...AD_PATH_KEYWORDS, ...safeExtraKeywords];

    for (const segment of block.segments) {
        const urlLower = segment.url.toLowerCase();
        for (const keyword of allKeywords) {
            if (urlLower.includes(keyword.toLowerCase())) {
                score += 2.5;
                break; // Only count once per segment
            }
        }
    }

    // Check filename pattern mismatch
    if (mainPattern.filenameRegex) {
        const mismatchCount = block.segments.filter(s => {
            if (!mainPattern.filenameRegex) return false; // No pattern to compare against
            const filename = extractFilename(s.url);
            return !mainPattern.filenameRegex.test(filename);
        }).length;

        if (mismatchCount === block.segments.length && block.segments.length > 0) {
            score += 1.5; // All filenames differ from main pattern
        }
    }

    // **KEY FEATURE**: Check path prefix mismatch (e.g., different date/folder/bitrate)
    // This is the most reliable indicator for ads that come from different CDN paths
    if (mainPattern.pathPrefix !== undefined && block.segments.length > 0) {
        const pathMismatchCount = block.segments.filter(s => {
            const segmentPathPrefix = extractPathPrefix(s.url);
            return segmentPathPrefix !== mainPattern.pathPrefix;
        }).length;

        if (pathMismatchCount === block.segments.length) {
            // ALL segments have different path prefix - strong ad indicator
            score += 5.0;
        }
    }

    return score;
}

/**
 * Threshold configuration
 */
export const THRESHOLDS = {
    HIGH: 5.0,   // Definitely an ad
    LOW: 3.0    // Possibly an ad (for future "fuzzy" mode)
};

/**
 * Determine if a block should be filtered based on its score
 */
export function shouldFilterBlock(score: number, threshold: number = THRESHOLDS.HIGH): boolean {
    return score >= threshold;
}
