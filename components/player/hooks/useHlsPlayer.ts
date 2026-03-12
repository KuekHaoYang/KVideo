import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { usePlayerSettings } from './usePlayerSettings';
import { filterM3u8Ad } from '@/lib/utils/m3u8-utils';

interface UseHlsPlayerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src: string;
    autoPlay?: boolean;
    onAutoPlayPrevented?: (error: Error) => void;
    onError?: (message: string) => void;
}

export function useHlsPlayer({
    videoRef,
    src,
    autoPlay = false,
    onAutoPlayPrevented,
    onError
}: UseHlsPlayerProps) {
    const hlsRef = useRef<Hls | null>(null);
    const { adFilterMode, adKeywords } = usePlayerSettings();
    const isAdFilterEnabled = adFilterMode !== 'off';

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        let hls: Hls | null = null;
        let extraBlobs: string[] = [];

        // Check if HLS is supported natively (Safari, Mobile Chrome)
        const isNativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl');

        // Check if MSE is available (required by HLS.js)
        const isMSESupported = Hls.isSupported();

        if (isMSESupported) {

            // Define custom loader class to intercept manifest loading
            // We use 'any' cast because default loader type might not be strictly exposed in all typings
            const DefaultLoader = (Hls as any).DefaultConfig.loader;

            class AdFilterLoader extends DefaultLoader {
                load(context: any, config: any, callbacks: any) {
                    if (isAdFilterEnabled && (context.type === 'manifest' || context.type === 'level')) {
                        const originalOnSuccess = callbacks.onSuccess;
                        callbacks.onSuccess = (response: any, stats: any, context: any, networkDetails: any) => {
                            if (typeof response.data === 'string') {
                                try {
                                    // Filter the content
                                    response.data = filterM3u8Ad(response.data, context.url, adFilterMode, adKeywords);
                                } catch (e) {
                                    console.warn('[HLS] Ad filter error:', e);
                                }
                            }
                            originalOnSuccess(response, stats, context, networkDetails);
                        };
                    }
                    super.load(context, config, callbacks);
                }
            }

            if (!isNativeHlsSupported || isAdFilterEnabled) {
                // If ad filtering is on, we force Hls.js even on native-supported desktop browsers
                // Exceptions might exist for iOS where MSE is strictly not available, check Hls.isSupported() result carefully.
                // Hls.isSupported() is false on iOS Safari usually, so this block won't run there.

                const config: any = {
                    // Worker & Performance
                    enableWorker: true,
                    lowLatencyMode: false,

                    // Buffer Settings
                    maxBufferLength: 60,
                    maxMaxBufferLength: 120,
                    maxBufferSize: 60 * 1000 * 1000,
                    maxBufferHole: 0.5,

                    // Start with more buffer
                    startFragPrefetch: true,

                    // ABR Settings
                    abrEwmaDefaultEstimate: 500000,
                    abrEwmaFastLive: 3,
                    abrEwmaSlowLive: 9,
                    abrEwmaFastVoD: 3,
                    abrEwmaSlowVoD: 9,
                    abrBandWidthFactor: 0.8,
                    abrBandWidthUpFactor: 0.7,

                    // Loading Settings
                    fragLoadingMaxRetry: 6,
                    fragLoadingRetryDelay: 1000,
                    fragLoadingMaxRetryTimeout: 64000,
                    manifestLoadingMaxRetry: 4,
                    manifestLoadingRetryDelay: 1000,
                    manifestLoadingMaxRetryTimeout: 64000,
                    levelLoadingMaxRetry: 4,
                    levelLoadingRetryDelay: 1000,
                    levelLoadingMaxRetryTimeout: 64000,

                    // Timeouts
                    fragLoadingTimeOut: 20000,
                    manifestLoadingTimeOut: 10000,
                    levelLoadingTimeOut: 10000,

                    // Backbuffer
                    backBufferLength: 30,
                };

                // Use custom loader if ad filtering is enabled
                if (isAdFilterEnabled) {
                    config.loader = AdFilterLoader;
                }

                hls = new Hls(config);
                hlsRef.current = hls;

                hls.loadSource(src);
                hls.attachMedia(video);

                // Auto Play Handler
                hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
                    if (autoPlay && video.paused && data.frag.start === 0) {
                        video.play().catch(console.warn);
                    }
                });

                // Manifest Parsed Handler
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    // Filter HEVC levels: prefer H.264 for compatibility
                    if (hls) {
                        const levels = hls.levels;
                        if (levels && levels.length > 0) {
                            const h264Indices: number[] = [];
                            let hasHEVC = false;
                            levels.forEach((level, index) => {
                                const codec = level.videoCodec?.toLowerCase() || '';
                                if (codec.includes('hev') || codec.includes('h265') || codec.includes('hvc')) {
                                    hasHEVC = true;
                                } else {
                                    h264Indices.push(index);
                                }
                            });
                            if (hasHEVC) {
                                if (h264Indices.length > 0) {
                                    // H.264 alternatives exist — lock to first H.264 level
                                    console.info('[HLS] HEVC detected, using H.264 level for compatibility');
                                    hls.currentLevel = h264Indices[0];
                                } else {
                                    // All levels are HEVC — warn user
                                    console.warn('[HLS] ⚠️ All levels are HEVC, browser may not support');
                                    onError?.('检测到 HEVC/H.265 编码，当前浏览器可能不支持');
                                }
                            }
                        }
                    }

                    if (autoPlay) {
                        video.play().catch((err) => {
                            // console.warn('[HLS] Autoplay prevented:', err);
                            onAutoPlayPrevented?.(err);
                        });
                    }
                });

                // Error Handling
                let networkErrorRetries = 0;
                let mediaErrorRetries = 0;
                const MAX_RETRIES = 3;

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                networkErrorRetries++;
                                if (networkErrorRetries <= MAX_RETRIES) {
                                    hls?.startLoad();
                                } else {
                                    onError?.('网络错误：无法加载视频流');
                                    hls?.destroy();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                mediaErrorRetries++;
                                if (mediaErrorRetries <= MAX_RETRIES) {
                                    hls?.recoverMediaError();
                                } else {
                                    onError?.('媒体错误：视频格式不支持或已损坏');
                                    hls?.destroy();
                                }
                                break;
                            default:
                                console.error('[HLS] Fatal error, cannot recover:', data);
                                onError?.(`致命错误：${data.details || '未知错误'}`);
                                hls?.destroy();
                                break;
                        }
                    }
                });
            } else {
                // Native HLS (Desktop Safari, no Filter)
                video.src = src;
            }
        } else if (isNativeHlsSupported) {
            // Native HLS (iOS, Mobile Safari)
            // Limitations: Native HLS cannot easily intercept sub-playlist requests.
            // We use fetch+blob for the master playlist as a best 'first-level' filter.
            // If the ad discontinuity is in the master playlist (rare for ads, common for periods), it works.
            // If it's in sub-playlists, it might fail unless we parse and blob those too (complex).

            if (isAdFilterEnabled) {
                const fetchWithFallback = async (url: string): Promise<string> => {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return await res.text();
                    } catch (e) {
                        console.warn(`[HLS Native] Fetch failed for ${url}, trying proxy...`, e);
                        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                        const res = await fetch(proxiedUrl);
                        if (!res.ok) throw new Error(`Proxy fetch failed: HTTP ${res.status}`);
                        return await res.text();
                    }
                };

                const processMasterPlaylist = async (masterSrc: string) => {
                    // Move blob tracking outside try to ensure cleanup on error
                    const createdBlobs: string[] = [];

                    // Safely resolve relative URLs to absolute (handles iOS Safari scenarios)
                    let absoluteMasterSrc: string;
                    try {
                        absoluteMasterSrc = new URL(masterSrc, window.location.href).toString();
                    } catch {
                        absoluteMasterSrc = masterSrc; // Fallback if URL parsing fails
                    }

                    try {
                        const masterContent = await fetchWithFallback(absoluteMasterSrc);

                        // If it's a simple playlist (no variants), just filter and play
                        if (!masterContent.includes('#EXT-X-STREAM-INF')) {
                            const filtered = filterM3u8Ad(masterContent, absoluteMasterSrc, adFilterMode, adKeywords);
                            const blob = new Blob([filtered], { type: 'application/vnd.apple.mpegurl' });
                            const blobUrl = URL.createObjectURL(blob);
                            createdBlobs.push(blobUrl);
                            return { masterBlobUrl: blobUrl, allBlobs: createdBlobs };
                        }

                        // It IS a master playlist. Use map + Promise.all for clean concurrent processing.
                        const lines = masterContent.split(/\r?\n/);



                        // Process each line, looking back at previous line to determine context
                        const lineProcessingPromises = lines.map(async (line, index) => {
                            const trimmedLine = line.trim();

                            // Handle #EXT-X-MEDIA:URI="..."
                            if (trimmedLine.startsWith('#EXT-X-MEDIA') && trimmedLine.includes('URI="')) {
                                const uriMatch = trimmedLine.match(/URI="([^"]+)"/);
                                const uri = uriMatch?.[1];
                                if (uri) {
                                    // Process if relative or absolute URL; fetch will handle CORS
                                    const isRelative = !uri.startsWith('http');

                                    if (isRelative || uri.startsWith('http')) {
                                        try {
                                            const absoluteUrl = isRelative ? new URL(uri, absoluteMasterSrc).toString() : uri;
                                            const subContent = await fetchWithFallback(absoluteUrl);
                                            const filteredSub = filterM3u8Ad(subContent, absoluteUrl, adFilterMode, adKeywords);
                                            const subBlob = new Blob([filteredSub], { type: 'application/vnd.apple.mpegurl' });
                                            const subBlobUrl = URL.createObjectURL(subBlob);
                                            createdBlobs.push(subBlobUrl);
                                            return line.replace(`URI="${uri}"`, `URI="${subBlobUrl}"`);
                                        } catch (e) {
                                            console.warn('[HLS Native] Failed to process EXT-X-MEDIA URI:', e);
                                            return line;
                                        }
                                    }
                                }
                            }

                            // Handle playlist URL (line after #EXT-X-STREAM-INF)
                            const prevLine = index > 0 ? lines[index - 1].trim() : '';
                            if (prevLine.startsWith('#EXT-X-STREAM-INF') && trimmedLine && !trimmedLine.startsWith('#')) {
                                // Process if relative or absolute URL; fetch will handle CORS
                                const isRelative = !trimmedLine.startsWith('http');

                                if (isRelative || trimmedLine.startsWith('http')) {
                                    try {
                                        const absoluteUrl = isRelative ? new URL(trimmedLine, absoluteMasterSrc).toString() : trimmedLine;
                                        const subContent = await fetchWithFallback(absoluteUrl);
                                        const filteredSub = filterM3u8Ad(subContent, absoluteUrl, adFilterMode, adKeywords);
                                        const subBlob = new Blob([filteredSub], { type: 'application/vnd.apple.mpegurl' });
                                        const subBlobUrl = URL.createObjectURL(subBlob);
                                        createdBlobs.push(subBlobUrl);
                                        return subBlobUrl;
                                    } catch (e) {
                                        console.warn('[HLS Native] Failed to process variant playlist:', e);
                                        return line;
                                    }
                                }
                            }

                            // All other lines pass through unchanged
                            return line;
                        });

                        const processedLines = await Promise.all(lineProcessingPromises);

                        // Join back
                        const finalMasterContent = processedLines.join('\n');
                        const masterBlob = new Blob([finalMasterContent], { type: 'application/vnd.apple.mpegurl' });
                        const masterBlobUrl = URL.createObjectURL(masterBlob);
                        createdBlobs.push(masterBlobUrl);

                        return { masterBlobUrl, allBlobs: createdBlobs };
                    } catch (e) {
                        // Critical: Clean up any blobs created before the error
                        for (const blobUrl of createdBlobs) {
                            try {
                                URL.revokeObjectURL(blobUrl);
                            } catch { /* ignore cleanup errors */ }
                        }
                        console.error('[HLS Native] Recursive fetch failed', e);
                        throw e;
                    }
                };

                processMasterPlaylist(src).then((result) => {
                    video.src = result.masterBlobUrl;
                    extraBlobs = result.allBlobs;

                    // Some WebView-based browsers (Alook, Arthur, etc.) cannot play from blob: URLs.
                    // Detect playback failure and fall back to the original source.
                    let blobPlaybackFailed = false;

                    const onBlobError = () => {
                        if (blobPlaybackFailed) return;
                        blobPlaybackFailed = true;
                        console.warn('[HLS Native] Blob URL playback failed, falling back to original source.');
                        video.removeEventListener('error', onBlobError);
                        onError?.('当前浏览器不支持广告过滤，已回退到原始视频流');
                        // Revoke blob URLs immediately
                        extraBlobs.forEach(url => URL.revokeObjectURL(url));
                        extraBlobs = [];
                        video.src = src;
                    };

                    video.addEventListener('error', onBlobError);

                    // Also set a timeout: if video hasn't started loading within 8s, fall back
                    const fallbackTimer = setTimeout(() => {
                        if (video.readyState === 0 && !blobPlaybackFailed) {
                            console.warn('[HLS Native] Blob URL playback timed out, falling back to original source.');
                            onBlobError();
                        }
                    }, 8000);

                    // Clear the timeout once video starts loading
                    const onLoadedData = () => {
                        clearTimeout(fallbackTimer);
                        video.removeEventListener('error', onBlobError);
                        video.removeEventListener('loadeddata', onLoadedData);
                    };
                    video.addEventListener('loadeddata', onLoadedData);
                }).catch((e) => {
                    console.warn('[HLS Native] Ad filtering failed, falling back to original source.', e);
                    onError?.('广告过滤失败，已回退到原始视频流');
                    video.src = src;
                });

            } else {
                video.src = src;
            }
        } else {
            // Neither MSE nor native HLS supported
            // Try direct playback as last resort (works for mp4 and some browser WebView)
            console.warn('[HLS] No MSE or native HLS support. Trying direct playback...');
            video.src = src;

            let directFailed = false;
            const handleCanPlay = () => {
                directFailed = false;
            };
            const handleError = () => {
                if (directFailed) return;
                directFailed = true;
                // Try proxied URL as final attempt
                const proxiedUrl = `/api/proxy?url=${encodeURIComponent(src)}`;
                video.src = proxiedUrl;
                video.addEventListener('error', () => {
                    onError?.('当前浏览器不支持 HLS 视频播放。建议使用 Chrome、Edge 或 Safari 浏览器。');
                }, { once: true });
            };

            video.addEventListener('canplay', handleCanPlay, { once: true });
            video.addEventListener('error', handleError, { once: true });
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
            extraBlobs.forEach(url => URL.revokeObjectURL(url));
        };
    }, [src, videoRef, autoPlay, onAutoPlayPrevented, onError, isAdFilterEnabled, adFilterMode, adKeywords]);
}
