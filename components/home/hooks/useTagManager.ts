import { useState, useEffect } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

const DEFAULT_TAG = { id: 'popular', label: '热门', value: '热门' };

const STORAGE_KEY_PREFIX = 'kvideo_custom_tags_';

export function useTagManager() {
    const [contentType, setContentType] = useState<'movie' | 'tv'>(() => {
        if (typeof window === 'undefined') return 'movie';
        const saved = localStorage.getItem('kvideo_default_content_type');
        return saved === 'tv' ? 'tv' : 'movie';
    });
    const [selectedTag, setSelectedTag] = useState(DEFAULT_TAG.value);
    const [tags, setTags] = useState<any[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [showTagManager, setShowTagManager] = useState(false);
    const [justAddedTag, setJustAddedTag] = useState(false);

    // Persist content type preference
    useEffect(() => {
        localStorage.setItem('kvideo_default_content_type', contentType);
    }, [contentType]);

    const storageKey = `${STORAGE_KEY_PREFIX}${contentType}`;

    // Load custom tags or fetch from Douban
    useEffect(() => {
        const loadTags = async () => {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    setTags(JSON.parse(saved));
                    return;
                } catch (e) {
                    console.error('Failed to parse saved tags', e);
                }
            }

            // If no saved tags, fetch from Douban
            setIsLoadingTags(true);
            try {
                const response = await fetch(`/api/douban/tags?type=${contentType}`);
                const data = await response.json();
                if (data.tags && Array.isArray(data.tags)) {
                    const mappedTags = data.tags.map((label: string) => ({
                        id: label === '热门' ? 'popular' : `tag_${label}`,
                        label,
                        value: label,
                    }));

                    // If "热门" isn't in the list, add it to the front
                    if (!mappedTags.some((t: any) => t.value === '热门')) {
                        mappedTags.unshift(DEFAULT_TAG);
                    }

                    setTags(mappedTags);
                    // Also save to localStorage to avoid repeated fetches if desired
                    // Actually, let's just keep them in memory for now unless they customize
                } else {
                    setTags([DEFAULT_TAG]);
                }
            } catch (error) {
                console.error('Fetch tags error:', error);
                setTags([DEFAULT_TAG]);
            } finally {
                setIsLoadingTags(false);
            }
        };

        loadTags();
        setSelectedTag(DEFAULT_TAG.value);
    }, [contentType, storageKey]);

    const saveTags = (newTags: any[]) => {
        setTags(newTags);
        localStorage.setItem(storageKey, JSON.stringify(newTags));
    };

    const handleAddTag = () => {
        if (!newTagInput.trim()) return;
        const newTag = {
            id: `custom_${Date.now()}`,
            label: newTagInput.trim(),
            value: newTagInput.trim(),
        };
        saveTags([...tags, newTag]);
        setNewTagInput('');
        setJustAddedTag(true);
    };

    const handleDeleteTag = (tagId: string) => {
        saveTags(tags.filter(t => t.id !== tagId));
        if (selectedTag === tagId) {
            setSelectedTag('popular');
        }
    };

    const handleRestoreDefaults = async () => {
        localStorage.removeItem(storageKey);
        // Refresh by re-fetching
        setIsLoadingTags(true);
        try {
            const response = await fetch(`/api/douban/tags?type=${contentType}`);
            const data = await response.json();
            if (data.tags && Array.isArray(data.tags)) {
                const mappedTags = data.tags.map((label: string) => ({
                    id: label === '热门' ? 'popular' : `tag_${label}`,
                    label,
                    value: label,
                }));
                if (!mappedTags.some((t: any) => t.value === '热门')) {
                    mappedTags.unshift(DEFAULT_TAG);
                }
                setTags(mappedTags);
            } else {
                setTags([DEFAULT_TAG]);
            }
        } catch (error) {
            setTags([DEFAULT_TAG]);
        } finally {
            setIsLoadingTags(false);
        }
        setSelectedTag(DEFAULT_TAG.value);
        setShowTagManager(false);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = tags.findIndex((tag) => tag.id === active.id);
            const newIndex = tags.findIndex((tag) => tag.id === over.id);
            saveTags(arrayMove(tags, oldIndex, newIndex));
        }
    };

    return {
        tags,
        selectedTag,
        contentType,
        newTagInput,
        showTagManager,
        justAddedTag,
        isLoadingTags,
        setContentType,
        setSelectedTag,
        setNewTagInput,
        setShowTagManager,
        setJustAddedTag,
        handleAddTag,
        handleDeleteTag,
        handleRestoreDefaults,
        handleDragEnd,
    };
}
