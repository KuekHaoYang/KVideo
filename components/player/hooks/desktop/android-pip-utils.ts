import type { FullscreenMode } from '../useDesktopPlayerState';

export interface AndroidPiPTransitionPlan {
    enterTemporaryWindowFullscreen: boolean;
    restoreInlineOnExit: boolean;
}

export interface AndroidPiPSessionState {
    enteredTemporaryWindowFullscreen: boolean;
    restoreInlineOnExit: boolean;
}

export interface AndroidPiPSourceRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export function createAndroidPiPTransitionPlan(fullscreenMode: FullscreenMode): AndroidPiPTransitionPlan {
    const enterTemporaryWindowFullscreen = fullscreenMode !== 'window';

    return {
        enterTemporaryWindowFullscreen,
        restoreInlineOnExit: enterTemporaryWindowFullscreen,
    };
}

export function shouldRestoreInlineAfterAndroidPiP(
    session: AndroidPiPSessionState | null,
    inPictureInPicture: boolean
): boolean {
    if (!session || inPictureInPicture) {
        return false;
    }

    return session.enteredTemporaryWindowFullscreen && session.restoreInlineOnExit;
}

export function shouldRollbackTemporaryWindowFullscreen(session: AndroidPiPSessionState | null): boolean {
    return Boolean(session?.enteredTemporaryWindowFullscreen);
}

export function getAndroidPiPSourceRect(container: HTMLElement | null): AndroidPiPSourceRect | null {
    if (!container) {
        return null;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return null;
    }

    return {
        left: Math.max(0, Math.round(rect.left)),
        top: Math.max(0, Math.round(rect.top)),
        right: Math.max(0, Math.round(rect.right)),
        bottom: Math.max(0, Math.round(rect.bottom)),
    };
}
