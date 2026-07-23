
/**
 * Utility functions for M3U8 playlist manipulation
 */

import { parseBlocks, learnMainPattern, scoreBlock, shouldFilterBlock, findDuplicateSignatureBlockIndices } from './m3u8-ad-detector';

/**
 * Filters ads from specific M3U8 content using multiple detection strategies:
 * 1. Keyword matching (configurable via env)
 * 2. CUE-OUT/CUE-IN standard tags
 * 3. Heuristic block analysis (filename patterns, ad path keywords, duration signature fingerprints)
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
    const keywords = customKeywords;

    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    let origin = '';
    try {
        origin = new URL(baseUrl).origin;
    } catch (e) { /* ignore */ }

    // 2. Global Scan: Check if any ad keywords exist in the content
    const hasKeywordMatch = mode !== 'off' && keywords.some(k => content.includes(k));
    const hasCueTag = mode !== 'off' && (content.includes('#EXT-X-CUE-OUT') || content.includes('#EXT-X-CUE-IN'));

    // 3. Heuristic Analysis: If no explicit ad signals, use block-based detection
    const lines = content.split(/\r?\n/);
    let adLineIndices = new Set<number>();

    if (!hasCueTag && (mode === 'heuristic' || mode === 'aggressive')) {
        // No obvious ad signals - run heuristic analysis
        const blocks = parseBlocks(lines);
        if (blocks.length > 1) {
            const mainPattern = learnMainPattern(blocks);
            const duplicateIndices = findDuplicateSignatureBlockIndices(blocks);

            blocks.forEach((block, blockIdx) => {
                const isDuplicate = duplicateIndices.has(blockIdx);
                const score = scoreBlock(block, mainPattern, keywords, isDuplicate);
                const threshold = mode === 'aggressive' ? 3.0 : 5.0;
                if (shouldFilterBlock(score, threshold)) {
                    // Mark all lines in this block for removal
                    for (const segment of block.segments) {
                        adLineIndices.add(segment.lineIndex);
                        adLineIndices.add(segment.lineIndex - 1); // EXTINF line
                    }
                }
            });
        }
    }

    const processedLines: string[] = [];

    // State machine for CUE-OUT/CUE-IN tracking
    let insideCueAdBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip lines marked by heuristic analysis
        if (adLineIndices.has(i)) {
            // Remove preceding DISCONTINUITY if we just entered an ad block
            if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() === '#EXT-X-DISCONTINUITY') {
                processedLines.pop();
            }
            continue;
        }

        // 3. CUE Tag Detection (SCTE-35 Standard)
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

        // 4. Keyword-based Ad Detection & Backtrack (skip if no keywords configured)
        if (keywords.length > 0 && hasKeywordMatch && keywords.some(keyword => trimmedLine.includes(keyword))) {
            // Found Ad: Remove it and backtrack to remove associated metadata
            while (processedLines.length > 0) {
                const lastIndex = processedLines.length - 1;
                const lastLine = processedLines[lastIndex].trim();

                if (lastLine.startsWith('#EXTINF:') || lastLine === '#EXT-X-DISCONTINUITY') {
                    processedLines.pop();
                } else {
                    break;
                }
            }
            continue; // Skip the ad line itself
        }

        // 5. Discontinuity Handling (Conservative Mode)
        // Keep Discontinuity tags by default, but avoid consecutive duplicates.
        if (trimmedLine === '#EXT-X-DISCONTINUITY') {
            if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() === '#EXT-X-DISCONTINUITY') {
                continue;
            }
            processedLines.push(line);
            continue;
        }

        // 6. General Cleanup & URL Normalization
        if (!trimmedLine || trimmedLine.startsWith('http') || trimmedLine.startsWith('blob:')) {
            processedLines.push(line);
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

        // 7. Resolve Relative URLs (for Blob support)
        if (trimmedLine.startsWith('/')) {
            processedLines.push(origin ? `${origin}${trimmedLine}` : trimmedLine);
        } else {
            processedLines.push(`${basePath}${trimmedLine}`);
        }
    }

    return processedLines.join('\n');
}
