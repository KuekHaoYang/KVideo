import { NextRequest } from 'next/server';
import { searchVideos } from '@/lib/api/client';
import { getSourceName } from '@/lib/utils/source-names';
import { traditionalToSimplified } from '@/lib/utils/chinese-convert';
import { requireAuthenticatedRequestIfConfigured } from '@/lib/server/api-access';
import { normalizeSourceConfigList } from '@/lib/server/source-validation';
import type { VideoItem, VideoSource } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_TOTAL_VIDEOS = 2000;
const MAX_PAGES_PER_SOURCE = 3;
const PER_SOURCE_TIMEOUT_MS = 20000;

interface SearchRequestBody {
  query?: unknown;
  sources?: unknown;
}

function withPresentationFields(videos: VideoItem[], source: VideoSource, latency: number) {
  return videos.map((video) => ({
    ...video,
    sourceDisplayName: getSourceName(source.id),
    latency,
  }));
}

export async function POST(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  const body = (await request.json()) as SearchRequestBody;
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const sources = await normalizeSourceConfigList(body.sources, 50);

  if (!query) {
    return Response.json({ error: 'Invalid query' }, { status: 400 });
  }

  if (sources.length === 0) {
    return Response.json({ error: 'No valid sources provided' }, { status: 400 });
  }

  const normalizedQuery = traditionalToSimplified(query);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const signal = request.signal;

      const safeSend = (data: object) => {
        if (signal.aborted) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Ignore closed controller errors.
        }
      };

      safeSend({ type: 'start', totalSources: sources.length });

      let completedSources = 0;
      let totalVideosFound = 0;

      const searchPromises = sources.map(async (source) => {
        if (signal.aborted) {
          return;
        }

        const startTime = performance.now();
        const sourceController = new AbortController();
        const sourceTimeout = setTimeout(() => sourceController.abort(), PER_SOURCE_TIMEOUT_MS);
        const onRequestAbort = () => sourceController.abort();
        signal.addEventListener('abort', onRequestAbort, { once: true });

        try {
          const [initialResult] = await searchVideos(
            normalizedQuery,
            [source],
            1,
            sourceController.signal,
          );

          const latency = Math.round(performance.now() - startTime);
          const videos = initialResult?.results || [];
          const pagecount = initialResult?.pagecount ?? 1;

          completedSources += 1;
          totalVideosFound += videos.length;

          if (videos.length > 0 && !signal.aborted) {
            safeSend({
              type: 'videos',
              videos: withPresentationFields(videos, source, latency),
              source: source.id,
              completedSources,
              totalSources: sources.length,
              latency,
            });
          }

          safeSend({
            type: 'progress',
            completedSources,
            totalSources: sources.length,
            totalVideosFound,
          });

          if (pagecount > 1 && totalVideosFound < MAX_TOTAL_VIDEOS && !signal.aborted) {
            const maxPages = Math.min(pagecount, MAX_PAGES_PER_SOURCE);

            for (let page = 2; page <= maxPages; page += 1) {
              if (signal.aborted || totalVideosFound >= MAX_TOTAL_VIDEOS) {
                break;
              }

              try {
                const [pageResult] = await searchVideos(
                  normalizedQuery,
                  [source],
                  page,
                  sourceController.signal,
                );
                const pageVideos = pageResult?.results || [];
                totalVideosFound += pageVideos.length;

                if (pageVideos.length > 0 && !signal.aborted) {
                  safeSend({
                    type: 'videos',
                    videos: withPresentationFields(pageVideos, source, latency),
                    source: source.id,
                    completedSources,
                    totalSources: sources.length,
                    latency,
                  });
                }

                safeSend({
                  type: 'progress',
                  completedSources,
                  totalSources: sources.length,
                  totalVideosFound,
                });
              } catch {
                // Ignore failed page fetches and continue.
              }
            }
          }
        } catch (error) {
          const latency = Math.round(performance.now() - startTime);
          console.error(`[Search] Source ${source.id} failed after ${latency}ms:`, error);
          completedSources += 1;

          safeSend({
            type: 'progress',
            completedSources,
            totalSources: sources.length,
            totalVideosFound,
          });
        } finally {
          clearTimeout(sourceTimeout);
          signal.removeEventListener('abort', onRequestAbort);
        }
      });

      await Promise.all(searchPromises);

      if (!signal.aborted) {
        safeSend({
          type: 'complete',
          totalVideosFound,
          totalSources: sources.length,
          maxPageCount: MAX_PAGES_PER_SOURCE,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
