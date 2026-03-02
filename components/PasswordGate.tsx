'use client';

import { useState, useEffect } from 'react';
import { getSession, setSession } from '@/lib/store/auth-store';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore } from '@/lib/store/settings-store';
import { useIPTVStore } from '@/lib/store/iptv-store';
import { Lock } from 'lucide-react';

/**
 * Sync IPTV sources from environment variable.
 * Format: JSON array [{name, url}] or comma-separated URLs.
 */
function syncIPTVSources(rawValue: string) {
    const iptvStore = useIPTVStore.getState();
    const existingUrls = new Set(iptvStore.sources.map(s => s.url));

    let entries: { name: string; url: string }[] = [];

    // Try JSON
    try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
            entries = parsed.filter((item: any) => item && typeof item.url === 'string');
        }
    } catch {
        // Try comma-separated URLs
        if (rawValue.includes('http')) {
            const urls = rawValue.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
            entries = urls.map((url, i) => ({
                name: urls.length > 1 ? `直播源 ${i + 1}` : '直播源',
                url,
            }));
        }
    }

    // Add new sources that don't already exist
    for (const entry of entries) {
        if (!existingUrls.has(entry.url)) {
            iptvStore.addSource(entry.name || '直播源', entry.url);
        }
    }
}

/**
 * Sync merge sources setting from environment variable.
 * Value: 'true' or '1' to enable grouped display mode.
 */
function syncMergeSources(rawValue: string) {
    const enabled = rawValue === 'true' || rawValue === '1';
    if (!enabled) return;

    const settings = settingsStore.getSettings();
    if (settings.searchDisplayMode !== 'grouped') {
        settingsStore.saveSettings({
            ...settings,
            searchDisplayMode: 'grouped',
        });
    }
}

export function PasswordGate({ children, hasAuth: initialHasAuth }: { children: React.ReactNode, hasAuth: boolean }) {
    // Enable background subscription syncing globally
    useSubscriptionSync();

    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [hasAuth, setHasAuth] = useState(initialHasAuth);
    const [persistSession, setPersistSession] = useState(true);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            // Check if already has a valid session
            const session = getSession();
            const isAuthenticated = !!session;

            // Initial fast check
            const localLocked = initialHasAuth && !isAuthenticated;
            if (mounted) {
                setIsLocked(localLocked);
                setIsClient(true);
            }

            // Fetch remote config & sync
            try {
                const res = await fetch('/api/auth');
                if (!res.ok) throw new Error('Failed to fetch auth config');

                const data = await res.json();

                if (mounted) {
                    setHasAuth(data.hasAuth);
                    setPersistSession(data.persistSession);

                    // Sync subscriptions
                    if (data.subscriptionSources) {
                        settingsStore.syncEnvSubscriptions(data.subscriptionSources);
                    }

                    // Sync IPTV sources from env
                    if (data.iptvSources) {
                        syncIPTVSources(data.iptvSources);
                    }

                    // Sync merge sources setting from env
                    if (data.mergeSources) {
                        syncMergeSources(data.mergeSources);
                    }

                    // Re-evaluate lock status with confirmed server state
                    const confirmLocked = data.hasAuth && !isAuthenticated;
                    setIsLocked(confirmLocked);
                }
            } catch (e) {
                console.error("PasswordGate init failed:", e);
            }
        };

        init();

        return () => { mounted = false; };
    }, [initialHasAuth]);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsValidating(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();

            if (data.valid) {
                setSession({
                    profileId: data.profileId,
                    name: data.name,
                    role: data.role,
                    customPermissions: data.customPermissions,
                }, data.persistSession ?? persistSession);

                // Reload to re-initialize stores with profiled keys
                window.location.reload();
                return;
            }
        } catch {
            // API error
        }

        // Password didn't match
        setError(true);
        setIsValidating(false);
        const form = document.getElementById('password-form');
        form?.classList.add('animate-shake');
        setTimeout(() => form?.classList.remove('animate-shake'), 500);
    };

    if (!isClient) return null; // Prevent hydration mismatch

    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg-color)] bg-[image:var(--bg-image)] text-[var(--text-color)]">
            <div className="w-full max-w-md p-4">
                <form
                    id="password-form"
                    onSubmit={handleUnlock}
                    className="bg-[var(--glass-bg)] backdrop-blur-[25px] saturate-[180%] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-md)] flex flex-col items-center gap-6 transition-all duration-[0.4s] cubic-bezier(0.2,0.8,0.2,1)"
                >
                    <div className="w-16 h-16 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] mb-2 shadow-[var(--shadow-sm)] border border-[var(--glass-border)]">
                        <Lock size={32} />
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">访问受限</h2>
                        <p className="text-[var(--text-color-secondary)]">请输入访问密码以继续</p>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(false);
                                }}
                                placeholder="输入密码..."
                                className={`w-full px-4 py-3 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border ${error ? 'border-red-500' : 'border-[var(--glass-border)]'
                                    } focus:outline-none focus:border-[var(--accent-color)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-all duration-[0.4s] cubic-bezier(0.2,0.8,0.2,1) text-[var(--text-color)] placeholder-[var(--text-color-secondary)]`}
                                autoFocus
                            />
                            {error && (
                                <p className="text-sm text-red-500 text-center animate-pulse">
                                    密码错误
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isValidating}
                            className="w-full py-3 px-4 bg-[var(--accent-color)] text-white font-bold rounded-[var(--radius-2xl)] hover:translate-y-[-2px] hover:brightness-110 shadow-[var(--shadow-sm)] hover:shadow-[0_4px_8px_var(--shadow-color)] active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isValidating ? '验证中...' : '登录'}
                        </button>
                    </div>
                </form>
            </div>
            <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
        </div>
    );
}
