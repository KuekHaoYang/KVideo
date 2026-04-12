'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useSiteIcon } from '@/components/SiteIconProvider';
import { Icons } from '@/components/ui/Icon';
import { siteConfig } from '@/lib/config/site-config';
import { getSession, clearSession, hasPermission, type AuthSession } from '@/lib/store/auth-store';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';
import { LogOut } from 'lucide-react';

interface NavbarProps {
    onReset: () => void;
    isPremiumMode?: boolean;
}

export function Navbar({ onReset, isPremiumMode = false }: NavbarProps) {
    const settingsHref = isPremiumMode ? '/premium/settings' : '/settings';
    const favoritesHref = isPremiumMode ? '/premium/favorites' : '/favorites';
    const [session] = useState<AuthSession | null>(() => getSession());
    const { iptvEnabled } = useRuntimeFeatures();
    const siteIconSrc = useSiteIcon();

    const handleLogout = () => {
        clearSession();
        // Navigate to root to clear search query params
        window.location.href = '/';
    };

    return (
        <nav className="sticky top-0 z-[2000] pt-4 pb-2" style={{
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform'
        }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-sm)] px-3 sm:px-6 py-2 sm:py-4 rounded-[var(--radius-2xl)]" style={{
                    transform: 'translate3d(0, 0, 0)'
                }}>
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                        <Link
                            href={isPremiumMode ? '/premium' : '/'}
                            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer min-w-0"
                            onClick={onReset}
                            data-focusable
                        >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex items-center justify-center flex-shrink-0">
                                <Image
                                    src={siteIconSrc}
                                    alt={siteConfig.name}
                                    width={40}
                                    height={40}
                                    unoptimized
                                    className="object-contain"
                                />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-lg sm:text-2xl font-bold text-[var(--text-color)] truncate">{siteConfig.name}</h1>
                                <p className="text-xs text-[var(--text-color-secondary)] hidden sm:block truncate">{siteConfig.description}</p>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            {/* IPTV Link - only show if user has iptv_access or no auth configured */}
                            {iptvEnabled && hasPermission('iptv_access') && (
                            <Link
                                href="/iptv"
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                                aria-label="直播"
                                title="直播"
                                data-focusable
                            >
                                <Icons.TV size={16} className="sm:w-5 sm:h-5" />
                            </Link>
                            )}

                            {/* User Info */}
                            {session && (
                                <div className="hidden sm:flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-xs">
                                        <div className="w-5 h-5 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-[10px] border border-[var(--glass-border)]">
                                            {session.name.charAt(0)}
                                        </div>
                                        <span className="text-[var(--text-color)] max-w-[60px] truncate">{session.name}</span>
                                        {session.role === 'admin' && (
                                            <span className="px-1 py-0.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded text-[10px] font-medium">
                                                管理
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color-secondary)] hover:text-red-500 hover:border-red-500/30 transition-all duration-200 cursor-pointer"
                                        aria-label="退出登录"
                                        title="退出登录"
                                    >
                                        <LogOut size={14} />
                                    </button>
                                </div>
                            )}
                            <a
                                href="https://github.com/KuekHaoYang/KVideo"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer hidden sm:flex"
                                aria-label="GitHub 仓库"
                            >
                                <Icons.Github size={20} />
                            </a>
                            <Link
                                href={favoritesHref}
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                                aria-label="我的收藏"
                                data-focusable
                            >
                                <Icons.Heart size={20} />
                            </Link>
                            <Link
                                href={settingsHref}
                                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                                aria-label="设置"
                                data-focusable
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 -960 960 960" fill="currentColor">
                                    <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
                                </svg>
                            </Link>
                            <ThemeSwitcher />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
