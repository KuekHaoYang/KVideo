
/**
 * Utility functions for M3U8 playlist manipulation
 */

import { parseBlocks, learnMainPattern, scoreBlock, shouldFilterBlock } from './m3u8-ad-detector';

const INTERSTITIAL_DATERANGE_MARKERS = [
    'class="com.apple.hls.interstitial"',
    'x-asset-uri=',
    'x-asset-list=',
    'x-playout-limit=',
    'x-resume-offset=',
    'x-restrict=',
    'cue="once"',
];

const AUXILIARY_AD_TAG_PREFIXES = [
    '#EXT-X-ASSET:',
    '#EXT-X-CUE-OUT-CONT',
    '#EXT-X-PLACEMENT-OPPORTUNITY',
    '#EXT-OATCLS-SCTE35',
    '#EXT-X-SCTE35',
];

const SEGMENT_METADATA_PREFIXES = [
    '#EXTINF:',
    '#EXT-X-BYTERANGE:',
    '#EXT-X-DISCONTINUITY',
    '#EXT-X-PROGRAM-DATE-TIME:',
];

function normalizeKeywords(keywords: string[]): string[] {
    return [...new Set(
        keywords
            .map((keyword) => keyword.trim().toLowerCase())
            .filter((keyword) => keyword.length > 0)
    )];
}

function hasKeywordMatch(line: string, normalizedKeywords: string[]): boolean {
    if (normalizedKeywords.length === 0) {
        return false;
    }

    const lowerLine = line.toLowerCase();
    return normalizedKeywords.some((keyword) => lowerLine.includes(keyword));
}

function isInterstitialDateRange(trimmedLine: string, normalizedKeywords: string[]): boolean {
    if (!trimmedLine.startsWith('#EXT-X-DATERANGE:')) {
        return false;
    }

    const lowerLine = trimmedLine.toLowerCase();
    return INTERSTITIAL_DATERANGE_MARKERS.some((marker) => lowerLine.includes(marker)) ||
        hasKeywordMatch(trimmedLine, normalizedKeywords);
}

function isAuxiliaryAdMetadataLine(trimmedLine: string, normalizedKeywords: string[]): boolean {
    return AUXILIARY_AD_TAG_PREFIXES.some((prefix) => trimmedLine.startsWith(prefix)) ||
        (trimmedLine.startsWith('#EXT-X-DATERANGE:') && hasKeywordMatch(trimmedLine, normalizedKeywords));
}

/**
 * Filters ads from specific M3U8 content using multiple detection strategies:
 * 1. Keyword matching (configurable via env)
 * 2. CUE-OUT/CUE-IN standard tags
 * 3. HLS interstitial metadata removal
 * 4. Heuristic block analysis (filename patterns, ad path keywords)
 * 
 * Also converts relative URLs to absolute URLs for Blob playback.
 * 
 * @param content The raw M3U8 content string
 * @param baseUrl The base URL of the M3U8 file (to resolve relative paths)
 * @returns The filtered M3U8 content
 */
export type AdFilterMode = 'off' | 'keyword' | 'heuristic' | 'aggressive';

export function filterM3u8Ad(content: string, baseUrl: string, mode: AdFilterMode = 'heuristic', customKeywords: string[] = []): string {
    if (!content) return '';

    // Use keywords passed from AdKeywordsWrapper (already loaded from env/file)
    const normalizedKeywords = normalizeKeywords(customKeywords);

    // Unwrap baseUrl if it's a proxy URL to get correct basePath and origin
    let effectiveBaseUrl = baseUrl;
    if (baseUrl.includes('/api/proxy?url=')) {
        try {
            const urlMatch = baseUrl.match(/[?&]url=([^&]+)/);
            if (urlMatch && urlMatch[1]) {
                effectiveBaseUrl = decodeURIComponent(urlMatch[1]);
            }
        } catch (e) { /* ignore */ }
    }

    const basePath = effectiveBaseUrl.substring(0, effectiveBaseUrl.lastIndexOf('/') + 1);
    let origin = '';
    try {
        origin = new URL(effectiveBaseUrl).origin;
    } catch (e) { /* ignore */ }

    // 2. Global Scan: Check if any ad keywords exist in the content
    const hasKeywordMatchInPlaylist = mode !== 'off' && hasKeywordMatch(content, normalizedKeywords);
    const hasCueTag = mode !== 'off' && (content.includes('#EXT-X-CUE-OUT') || content.includes('#EXT-X-CUE-IN'));

    // 3. Heuristic Analysis: If no explicit ad signals, use block-based detection
    const lines = content.split(/\r?\n/);
    let adLineIndices = new Set<number>();

    if (!hasCueTag && (mode === 'heuristic' || mode === 'aggressive')) {
        // No obvious ad signals - run heuristic analysis
        const blocks = parseBlocks(lines);
        if (blocks.length > 0) {
            const mainPattern = learnMainPattern(blocks);
            for (const block of blocks) {
                // Pass all keywords (including custom ones) to heuristic scorer
                const score = scoreBlock(block, mainPattern, normalizedKeywords);
                const threshold = mode === 'aggressive' ? 3.0 : 5.0;

                if (shouldFilterBlock(score, threshold)) {
                    // Mark all lines in this block for removal
                    for (const segment of block.segments) {
                        adLineIndices.add(segment.lineIndex);
                        adLineIndices.add(segment.lineIndex - 1); // EXTINF line
                    }
                } else if (block.segments.length > 0) {
                    // Segment-level detection: 
                    // Even if the whole block didn't trigger, check segments individually 
                    // if it's a suspicious single-segment "block" (common for ads without discontinuity)
                    for (const segment of block.segments) {
                        const singleSegmentBlock = {
                            segments: [segment],
                            hasCueTag: false,
                            startLineIndex: segment.lineIndex - 1,
                            endLineIndex: segment.lineIndex
                        };
                        const segmentScore = scoreBlock(singleSegmentBlock, mainPattern, normalizedKeywords);
                        // Higher threshold for individual segments to avoid false positives
                        if (segmentScore >= 4.0) {
                            adLineIndices.add(segment.lineIndex);
                            adLineIndices.add(segment.lineIndex - 1);
                        }
                    }
                }
            }
        }
    }

    const processedLines: string[] = [];
    let hasKeptMediaLine = false;

    // State machine for CUE-OUT/CUE-IN tracking
    let insideCueAdBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip lines marked by heuristic analysis
        if (adLineIndices.has(i)) {
            continue;
        }

        // 4. Strip modern HLS interstitial metadata before the player can schedule it.
        if (
            mode !== 'off' &&
            (isInterstitialDateRange(trimmedLine, normalizedKeywords) ||
                isAuxiliaryAdMetadataLine(trimmedLine, normalizedKeywords))
        ) {
            continue;
        }

        // 5. CUE Tag Detection (SCTE-35 Standard)
        // EXT-X-CUE-OUT marks start of ad, EXT-X-CUE-IN marks end
        if (mode !== 'off' && trimmedLine.startsWith('#EXT-X-CUE-OUT')) {
            insideCueAdBlock = true;
            // Remove preceding DISCONTINUITY if present
            if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() === '#EXT-X-DISCONTINUITY') {
                processedLines.pop();
            }
            continue; // Skip the CUE-OUT tag itself
        }

        if (trimmedLine.startsWith('#EXT-X-CUE-IN')) {
            insideCueAdBlock = false;
            // Also skip the next line if it's a DISCONTINUITY (ad block ending marker)
            if (i + 1 < lines.length && lines[i + 1].trim() === '#EXT-X-DISCONTINUITY') {
                i++; // Skip the following DISCONTINUITY
            }
            continue; // Skip the CUE-IN tag itself
        }

        // Skip all content inside CUE ad block
        if (insideCueAdBlock) {
            continue;
        }

        // 6. Keyword-based Ad Detection & Backtrack (skip if no keywords configured)
        if (
            normalizedKeywords.length > 0 &&
            hasKeywordMatchInPlaylist &&
            hasKeywordMatch(trimmedLine, normalizedKeywords)
        ) {
            // Found Ad: Remove it and backtrack to remove associated metadata
            while (processedLines.length > 0) {
                const lastIndex = processedLines.length - 1;
                const lastLine = processedLines[lastIndex].trim();

                if (SEGMENT_METADATA_PREFIXES.some((prefix) => lastLine.startsWith(prefix))) {
                    processedLines.pop();
                } else {
                    break;
                }
            }
            continue; // Skip the ad line itself
        }

        // 7. Discontinuity Handling (Conservative Mode)
        // Keep all Discontinuity tags by default.
        // They will ONLY be removed via backtracking when a confirmed ad segment is found.
        // This prevents false positives on legitimate concatenated streams.
        if (trimmedLine === '#EXT-X-DISCONTINUITY') {
            if (
                !hasKeptMediaLine ||
                processedLines[processedLines.length - 1].trim() === '#EXT-X-DISCONTINUITY'
            ) {
                continue;
            }
            processedLines.push(line);
            continue;
        }

        // 8. General Cleanup & URL Normalization
        if (!trimmedLine || trimmedLine.startsWith('http') || trimmedLine.startsWith('blob:')) {
            processedLines.push(line);
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                hasKeptMediaLine = true;
            }
            continue;
        }

        if (trimmedLine.startsWith('#')) {
            // Handle URI="..." in attributes (e.g. #EXT-X-KEY)
            if (trimmedLine.includes('URI="')) {
                processedLines.push(line.replace(/URI="([^"]+)"/g, (match, uri) => {
                    if (uri.startsWith('http')) return match; // Already absolute
                    if (uri.startsWith('/')) {
                        return `URI="${origin}${uri}"`; // Root-relative
                    }
                    return `URI="${basePath}${uri}"`; // Path-relative
                }));
            } else {
                processedLines.push(line);
            }
            continue;
        }

        // 9. Resolve Relative URLs (for Blob support)
        if (trimmedLine.startsWith('/')) {
            processedLines.push(origin ? `${origin}${trimmedLine}` : trimmedLine);
        } else {
            processedLines.push(`${basePath}${trimmedLine}`);
        }
        hasKeptMediaLine = true;
    }

    while (
        processedLines.length > 0 &&
        processedLines[processedLines.length - 1].trim() === '#EXT-X-DISCONTINUITY'
    ) {
        processedLines.pop();
    }

    return processedLines.join('\n');
}
