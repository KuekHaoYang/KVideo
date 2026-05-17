import { NextResponse } from 'next/server';
import type { VideoSource } from '@/lib/types';
import { PREMIUM_SOURCES } from '@/lib/api/premium-sources';
import { fetchWithPolicy } from '@/lib/server/outbound-policy';
import { normalizeSourceConfigList } from '@/lib/server/source-validation';

export const runtime = 'nodejs';

export const revalidate = 3600; // Cache for 1 hour

function encodeBase64Utf8(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

interface Category {
    type_id: number;
    type_name: string;
}

interface PremiumTypesResponse {
    class?: Category[];
}

// Shared handler
async function handleTypesRequest(sourceList: VideoSource[]) {
    try {
        const enabledSources = sourceList.filter(s => s.enabled);

        const results = await Promise.allSettled(
            enabledSources.map(async (source) => {
                try {
                    const url = new URL(source.baseUrl);
                    url.searchParams.set('ac', 'list');

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                    const response = await fetchWithPolicy(url, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        },
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const data = (await response.json()) as PremiumTypesResponse;
                    return {
                        sourceId: source.id,
                        sourceName: source.name,
                        categories: data.class || []
                    };
                } catch (error) {
                    console.error(`Failed to fetch categories from ${source.name}:`, error);
                    return null;
                }
            })
        );

        const allTags = [];

        // Add "Recommend" tag first
        allTags.push({
            id: 'recommend',
            label: '今日推荐',
            value: ''
        });

        // Map to store merged categories: type_name -> Array of "sourceId:typeId"
        // Using a more complex structure to support fuzzy matching
        interface MergedCategory {
            label: string;
            values: string[];
        }
        const mergedCategories: MergedCategory[] = [];

        // Helper to clean label for comparison (remove common noise words)
        const cleanLabel = (label: string) => {
            return label.replace(/[视频片区专]/g, '');
        };

        // Helper to check if two labels match fuzzily (>= 4 chars overlap)
        const isFuzzyMatch = (label1: string, label2: string) => {
            const clean1 = cleanLabel(label1);
            const clean2 = cleanLabel(label2);

            // If either is too short after cleaning, require exact match
            if (clean1.length < 4 || clean2.length < 4) {
                return clean1 === clean2;
            }

            // Check for 4+ char overlap
            let overlapCount = 0;
            const set1 = new Set(clean1.split(''));
            for (const char of clean2) {
                if (set1.has(char)) {
                    overlapCount++;
                }
            }
            return overlapCount >= 4;
        };

        // Process results
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                const { sourceId, categories } = result.value;

                categories.forEach((cat: Category) => {
                    const typeName = cat.type_name.trim();
                    // Skip empty type names
                    if (!typeName) return;

                    const value = `${sourceId}:${cat.type_id}`;

                    // Try to find a fuzzy match in existing categories
                    let matched = false;
                    for (const existing of mergedCategories) {
                        if (isFuzzyMatch(existing.label, typeName)) {
                            existing.values.push(value);
                            // Update label to the longer one if the new one is longer (usually more descriptive)
                            // Or keep the shorter one? Let's keep the one that is "cleaner" or just the first one.
                            // Let's stick to the first one for stability.
                            matched = true;
                            break;
                        }
                    }

                    if (!matched) {
                        mergedCategories.push({
                            label: typeName,
                            values: [value]
                        });
                    }
                });
            }
        });

        // Convert merged categories to tags
        mergedCategories.forEach((cat) => {
            // Skip categories with no values (shouldn't happen with current logic but good for safety)
            if (cat.values.length === 0) return;

            // Create a unique ID based on the label (using base64 to be safe)
            const id = encodeBase64Utf8(cat.label);

            allTags.push({
                id,
                label: cat.label,
                value: cat.values.join(',') // Join multiple sources with comma
            });
        });

        return NextResponse.json({ tags: allTags });
    } catch (error) {
        console.error('Failed to aggregate categories:', error);
        return NextResponse.json(
            { tags: [], error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sources } = body;
        return await handleTypesRequest(await normalizeSourceConfigList(sources));
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

export async function GET() {
    return await handleTypesRequest(await normalizeSourceConfigList(PREMIUM_SOURCES));
}
