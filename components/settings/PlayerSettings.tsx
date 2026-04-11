'use client';

/**
 * PlayerSettings - Global settings for the video player
 * Following Liquid Glass design system
 */

import { Icons } from '@/components/ui/Icon';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';
import { Switch } from '@/components/ui/Switch';
import {
    type ProxyMode,
    DEFAULT_SEEK_STEP_SECONDS,
    MIN_SEEK_STEP_SECONDS,
    MAX_SEEK_STEP_SECONDS,
} from '@/lib/store/settings-store';

interface PlayerSettingsProps {
    fullscreenType: 'auto' | 'native' | 'window';
    onFullscreenTypeChange: (type: 'auto' | 'native' | 'window') => void;
    proxyMode: ProxyMode;
    onProxyModeChange: (mode: ProxyMode) => void;
    seekStepSeconds: number;
    onSeekStepSecondsChange: (value: number) => void;
    videoTogetherEnabled?: boolean;
    onVideoTogetherEnabledChange?: (enabled: boolean) => void;
    danmakuApiUrl: string;
    onDanmakuApiUrlChange: (url: string) => void;
    danmakuOpacity: number;
    onDanmakuOpacityChange: (value: number) => void;
    danmakuFontSize: number;
    onDanmakuFontSizeChange: (value: number) => void;
    danmakuDisplayArea: number;
    onDanmakuDisplayAreaChange: (value: number) => void;
    showDanmakuApi?: boolean;
}

const DANMAKU_FONT_SIZES = [14, 18, 20, 24, 28];
const DANMAKU_DISPLAY_AREAS = [
    { value: 0.25, label: '1/4屏' },
    { value: 0.5, label: '半屏' },
    { value: 0.75, label: '3/4屏' },
    { value: 1.0, label: '全屏' },
];
const SEEK_STEP_PRESETS = [5, 10, 15, 30, 60];

export function PlayerSettings({
    fullscreenType,
    onFullscreenTypeChange,
    proxyMode,
    onProxyModeChange,
    seekStepSeconds,
    onSeekStepSecondsChange,
    videoTogetherEnabled,
    onVideoTogetherEnabledChange,
    danmakuApiUrl,
    onDanmakuApiUrlChange,
    danmakuOpacity,
    onDanmakuOpacityChange,
    danmakuFontSize,
    onDanmakuFontSizeChange,
    danmakuDisplayArea,
    onDanmakuDisplayAreaChange,
    showDanmakuApi = true,
}: PlayerSettingsProps) {
    const { mediaProxyEnabled, restrictionSummary } = useRuntimeFeatures();
    const effectiveProxyMode = mediaProxyEnabled ? proxyMode : 'none';

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6 mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-color)] mb-4">播放器设置</h2>

            <div className="space-y-6">
                {/* Fullscreen Mode Selection */}
                <div>
                    <h3 className="font-medium text-[var(--text-color)] mb-2 inline-flex items-center gap-2">
                        <Icons.Maximize size={18} className="text-[var(--accent-color)]" />
                        默认全屏方式
                    </h3>
                    <p className="text-sm text-[var(--text-color-secondary)] mb-4">
                        选择在桌面端点击播放器全屏按钮时的行为
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => onFullscreenTypeChange('native')}
                            className={`px-4 py-3 rounded-[var(--radius-2xl)] border text-left font-medium transition-all duration-200 cursor-pointer ${fullscreenType === 'native'
                                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                }`}
                        >
                            <div className="font-semibold">系统全屏</div>
                            <div className="text-sm opacity-80 mt-1">进入浏览器原生全屏状态</div>
                        </button>
                        <button
                            onClick={() => onFullscreenTypeChange('window')}
                            className={`px-4 py-3 rounded-[var(--radius-2xl)] border text-left font-medium transition-all duration-200 cursor-pointer ${fullscreenType === 'window'
                                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                }`}
                        >
                            <div className="font-semibold">网页全屏</div>
                            <div className="text-sm opacity-80 mt-1">播放器填满当前浏览器窗口</div>
                        </button>
                    </div>
                </div>

                <div className="border-t border-[var(--glass-border)]" />

                <div>
                    <h3 className="font-medium text-[var(--text-color)] mb-2 inline-flex items-center gap-2">
                        <Icons.FastForward size={18} className="text-[var(--accent-color)]" />
                        快进 / 快退间隔
                    </h3>
                    <p className="text-sm text-[var(--text-color-secondary)] mb-4">
                        控制键盘 J / L、方向键和双击手势每次跳转的秒数
                    </p>

                    <div className="flex gap-2 flex-wrap mb-4">
                        {SEEK_STEP_PRESETS.map((seconds) => (
                            <button
                                key={seconds}
                                onClick={() => onSeekStepSecondsChange(seconds)}
                                className={`px-3 py-1.5 rounded-[var(--radius-2xl)] border text-sm font-medium transition-all duration-200 cursor-pointer ${seekStepSeconds === seconds
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                    }`}
                            >
                                {seconds} 秒
                            </button>
                        ))}
                    </div>

                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                            自定义秒数
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={MIN_SEEK_STEP_SECONDS}
                                max={MAX_SEEK_STEP_SECONDS}
                                step="1"
                                inputMode="numeric"
                                value={seekStepSeconds}
                                onChange={(e) => {
                                    if (e.target.value === '') return;
                                    const nextValue = Number(e.target.value);
                                    if (Number.isNaN(nextValue)) return;
                                    onSeekStepSecondsChange(nextValue);
                                }}
                                className="w-full px-4 py-2.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)] transition-colors text-sm"
                            />
                            <span className="text-sm text-[var(--text-color-secondary)]">秒</span>
                        </div>
                        <p className="text-xs text-[var(--text-color-secondary)] mt-1.5">
                            范围 {MIN_SEEK_STEP_SECONDS}-{MAX_SEEK_STEP_SECONDS} 秒，默认 {DEFAULT_SEEK_STEP_SECONDS} 秒
                        </p>
                    </div>
                </div>

                <div className="border-t border-[var(--glass-border)]" />

                {/* Proxy Mode Selection */}
                <div>
                    <h3 className="font-medium text-[var(--text-color)] mb-2 inline-flex items-center gap-2">
                        <Icons.Globe size={18} className="text-[var(--accent-color)]" />
                        代理播放模式
                    </h3>
                    <p className="text-sm text-[var(--text-color-secondary)] mb-4">
                        控制视频播放时的网络请求策略
                    </p>
                    {mediaProxyEnabled ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => onProxyModeChange('retry')}
                                className={`px-4 py-3 rounded-[var(--radius-2xl)] border text-left font-medium transition-all duration-200 cursor-pointer ${effectiveProxyMode === 'retry'
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                    }`}
                            >
                                <div className="font-semibold">智能重试 (推荐)</div>
                                <div className="text-sm opacity-80 mt-1">直连优先，失败时尝试代理</div>
                            </button>
                            <button
                                onClick={() => onProxyModeChange('none')}
                                className={`px-4 py-3 rounded-[var(--radius-2xl)] border text-left font-medium transition-all duration-200 cursor-pointer ${effectiveProxyMode === 'none'
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                    }`}
                            >
                                <div className="font-semibold">仅直连</div>
                                <div className="text-sm opacity-80 mt-1">不使用代理，失败则报错</div>
                            </button>
                            <button
                                onClick={() => onProxyModeChange('always')}
                                className={`px-4 py-3 rounded-[var(--radius-2xl)] border text-left font-medium transition-all duration-200 cursor-pointer ${effectiveProxyMode === 'always'
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                    }`}
                            >
                                <div className="font-semibold">总是代理</div>
                                <div className="text-sm opacity-80 mt-1">所有请求都通过代理转发</div>
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius-2xl)] border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                            <div className="font-semibold text-[var(--text-color)]">当前部署仅支持直连播放</div>
                            <div className="text-sm text-[var(--text-color-secondary)] mt-1">
                                {restrictionSummary}
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-[var(--glass-border)]" />

                {typeof videoTogetherEnabled === 'boolean' && onVideoTogetherEnabledChange ? (
                    <>
                        <div>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-medium text-[var(--text-color)] mb-2 inline-flex items-center gap-2">
                                        <Icons.Users size={18} className="text-[var(--accent-color)]" />
                                        一起看 (VideoTogether)
                                    </h3>
                                    <p className="text-sm text-[var(--text-color-secondary)]">
                                        关闭后不显示一起看悬浮入口；开启后仅在播放器和 IPTV 页面显示，且默认折叠为小图标，用户可自行展开。
                                    </p>
                                </div>
                                <Switch
                                    checked={videoTogetherEnabled}
                                    onChange={onVideoTogetherEnabledChange}
                                    ariaLabel="一起看开关"
                                />
                            </div>
                        </div>

                        <div className="border-t border-[var(--glass-border)]" />
                    </>
                ) : null}

                {/* Danmaku Settings */}
                <div>
                    <h3 className="font-medium text-[var(--text-color)] mb-2 inline-flex items-center gap-2">
                        <Icons.Danmaku size={18} className="text-[var(--accent-color)]" />
                        弹幕设置
                    </h3>
                    <p className="text-sm text-[var(--text-color-secondary)] mb-4">
                        配置弹幕聚合 API 地址，在播放器菜单中开关弹幕
                    </p>

                    {/* API URL */}
                    <div className="space-y-4">
                        {showDanmakuApi && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                                API 地址
                            </label>
                            <input
                                type="text"
                                placeholder="https://your-danmu-api.example.com"
                                value={danmakuApiUrl}
                                onChange={(e) => onDanmakuApiUrlChange(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)] transition-colors text-sm"
                            />
                            <p className="text-xs text-[var(--text-color-secondary)] mt-1.5">
                                兼容 <a href="https://github.com/huangxd-/danmu_api" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-color)] hover:underline">danmu_api</a> 格式的弹幕聚合服务
                            </p>
                        </div>
                        )}

                        {/* Opacity */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                                弹幕透明度：{Math.round(danmakuOpacity * 100)}%
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={Math.round(danmakuOpacity * 100)}
                                onChange={(e) => onDanmakuOpacityChange(parseInt(e.target.value) / 100)}
                                className="w-full accent-[var(--accent-color)] h-2"
                            />
                        </div>

                        {/* Font Size */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                                弹幕字号
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {DANMAKU_FONT_SIZES.map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => onDanmakuFontSizeChange(size)}
                                        className={`px-3 py-1.5 rounded-[var(--radius-2xl)] border text-sm font-medium transition-all duration-200 cursor-pointer ${danmakuFontSize === size
                                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                            : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                            }`}
                                    >
                                        {size}px
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Display Area */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-color)] mb-2">
                                弹幕显示区域
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {DANMAKU_DISPLAY_AREAS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => onDanmakuDisplayAreaChange(value)}
                                        className={`px-3 py-1.5 rounded-[var(--radius-2xl)] border text-sm font-medium transition-all duration-200 cursor-pointer ${danmakuDisplayArea === value
                                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                                            : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
