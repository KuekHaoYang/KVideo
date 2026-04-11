'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const registerServiceWorker = () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    registration.update().catch(() => {
                        // Ignore update check errors.
                    });
                })
                .catch(() => {
                    // Ignore registration failures.
                });
        };

        if (document.readyState === 'complete') {
            registerServiceWorker();
            return;
        }

        window.addEventListener('load', registerServiceWorker, { once: true });
        return () => window.removeEventListener('load', registerServiceWorker);
    }, []);

    return null;
}
