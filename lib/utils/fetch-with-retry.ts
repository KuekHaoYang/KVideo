import { fetchWithPolicy } from '@/lib/server/outbound-policy';

interface FetchWithRetryOptions {
    url: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxRetries?: number;
}

export async function fetchWithRetry({
    url,
    headers = {},
    signal,
    timeoutMs = 30000,
    maxRetries = 3,
}: FetchWithRetryOptions): Promise<Response> {
    let lastError: unknown = null;
    let response: Response | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
            const backoffDelay = attempt > 1 ? Math.pow(2, attempt - 2) * 100 : 0;
            if (backoffDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            if (signal) {
                if (signal.aborted) {
                    clearTimeout(timeoutId);
                    controller.abort();
                } else {
                    signal.addEventListener('abort', () => controller.abort(), { once: true });
                }
            }

            response = await fetchWithPolicy(url, {
                headers: {
                    ...headers,
                    'Accept': '*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                break;
            }

            if (response.status === 503 && attempt < maxRetries) {
                console.warn(`⚠ Got 503 on attempt ${attempt}, retrying with backoff ${backoffDelay}ms...`);
                lastError = `503 on attempt ${attempt}`;
                continue;
            }

            console.warn(`✗ Got ${response.status} on attempt ${attempt}`);
            break;
        } catch (fetchError) {
            lastError = fetchError;
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.warn(`⚠ Timeout on attempt ${attempt}, retrying...`);
            } else if (attempt < maxRetries) {
                console.warn(`⚠ Fetch error on attempt ${attempt}, retrying...`, fetchError);
            } else {
                throw fetchError;
            }
        }
    }

    // If we got a response (even an error response like 403, 404), return it
    // Only throw if we truly failed to get any response
    if (!response) {
        throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
    }

    // Return the response even if it's an error status (403, 404, etc.)
    // The caller can check response.ok or response.status
    if (!response.ok) {
        console.warn(`⚠ Returning non-OK response: ${response.status} ${response.statusText}`);
    }

    return response;
}
