'use client';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableTag, Tag } from './SortableTag';
import { useState, useRef, useEffect } from 'react';
import { Icons } from '@/components/ui/Icon';

interface RecommendTagConfig {
    label: string;
    isSelected: boolean;
    onSelect: () => void;
}

interface TagListProps {
    tags: Tag[];
    selectedTag: string;
    showTagManager: boolean;
    justAddedTag: boolean;
    onTagSelect: (tagId: string) => void;
    onTagDelete: (tagId: string) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onJustAddedTagHandled: () => void;
    recommendTag?: RecommendTagConfig;
}

export function TagList({
    tags,
    selectedTag,
    showTagManager,
    justAddedTag,
    onTagSelect,
    onTagDelete,
    onDragEnd,
    onJustAddedTagHandled,
    recommendTag,
}: TagListProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Auto-scroll to end when new tag is added
    useEffect(() => {
        if (justAddedTag && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: scrollContainerRef.current.scrollWidth,
                behavior: 'smooth',
            });
            onJustAddedTagHandled();
        }
    }, [justAddedTag, onJustAddedTagHandled]);

    // Handle horizontal scroll with mouse wheel
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Check if it's a vertical scroll (mostly deltaY) and negligible horizontal scroll
            if (e.deltaY !== 0 && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        };

        // Add passive: false to allow preventDefault
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        onDragEnd(event);
    };

    const activeTag = tags.find((t) => t.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div
                ref={scrollContainerRef}
                className="mb-8 flex items-center gap-3 overflow-x-auto pb-3 pt-2 px-1 scrollbar-hide"
            >
                {/* Recommendation Tag — non-draggable, rendered before sortable tags */}
                {recommendTag && (
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={recommendTag.onSelect}
                            className={`
                                px-6 py-2.5 text-sm font-semibold transition-all whitespace-nowrap rounded-[var(--radius-full)] cursor-pointer select-none flex items-center gap-1.5
                                ${recommendTag.isSelected
                                    ? 'bg-[var(--accent-color)] text-white shadow-md scale-105'
                                    : 'bg-[var(--glass-bg)] backdrop-blur-xl text-[var(--text-color)] border border-[var(--glass-border)] hover:border-[var(--accent-color)] hover:scale-105'
                                }
                            `}
                        >
                            <Icons.Sparkles size={14} />
                            {recommendTag.label}
                        </button>
                    </div>
                )}
                <SortableContext
                    items={tags.map((t) => t.id)}
                    strategy={horizontalListSortingStrategy}
                >
                    {tags.map((tag) => (
                        <SortableTag
                            key={tag.id}
                            tag={tag}
                            selectedTag={selectedTag}
                            showTagManager={showTagManager}
                            onTagSelect={onTagSelect}
                            onTagDelete={onTagDelete}
                        />
                    ))}
                </SortableContext>
            </div>

            <DragOverlay>
                {activeId && activeTag ? (
                    <div className="relative flex-shrink-0 animate-jiggle">
                        <button className="px-6 py-2.5 text-sm font-semibold whitespace-nowrap rounded-[var(--radius-full)] bg-[var(--accent-color)] text-white shadow-xl scale-110 cursor-grabbing border border-transparent">
                            {activeTag.label}
                        </button>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
