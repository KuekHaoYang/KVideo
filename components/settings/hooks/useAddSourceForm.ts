/**
 * Form hook for AddSourceModal
 */

'use client';

import { useState, useEffect } from 'react';
import type { VideoSource } from '@/lib/types';

interface UseAddSourceFormProps {
    isOpen: boolean;
    existingIds: string[];
    onAdd: (source: VideoSource) => void;
    onClose: () => void;
    initialValues?: VideoSource | null;
}

function generateIdFromName(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return slug || `custom-${Date.now().toString(36)}`;
}

export function useAddSourceForm({ isOpen, existingIds, onAdd, onClose, initialValues }: UseAddSourceFormProps) {
    const [name, setName] = useState('');
    const [customId, setCustomId] = useState('');
    const [idManuallyEdited, setIdManuallyEdited] = useState(false);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialValues) {
                setName(initialValues.name);
                setCustomId(initialValues.id);
                setUrl(initialValues.baseUrl);
                setIdManuallyEdited(true);
            } else {
                setName('');
                setCustomId('');
                setUrl('');
                setIdManuallyEdited(false);
            }
            setError('');
        }
    }, [isOpen, initialValues]);

    const handleNameChange = (newName: string) => {
        setName(newName);
        if (!idManuallyEdited && !initialValues) {
            setCustomId(generateIdFromName(newName));
        }
    };

    const handleIdChange = (newId: string) => {
        setIdManuallyEdited(true);
        setCustomId(newId);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim() || !url.trim()) {
            setError('请填写所有字段');
            return;
        }

        try {
            new URL(url);
        } catch {
            setError('请输入有效的 URL');
            return;
        }

        const id = customId.trim() || generateIdFromName(name);

        if (!initialValues && existingIds.includes(id)) {
            setError('此源 ID 已存在，请修改源 ID');
            return;
        }

        const newSource: VideoSource = {
            id,
            name: name.trim(),
            baseUrl: url.trim(),
            searchPath: initialValues?.searchPath || '',
            detailPath: initialValues?.detailPath || '',
            enabled: initialValues?.enabled ?? true,
            priority: initialValues?.priority || existingIds.length + 1,
        };

        onAdd(newSource);
        onClose();
    };

    return {
        name,
        setName: handleNameChange,
        customId,
        setCustomId: handleIdChange,
        url,
        setUrl,
        error,
        handleSubmit,
        isEditing: !!initialValues,
    };
}
