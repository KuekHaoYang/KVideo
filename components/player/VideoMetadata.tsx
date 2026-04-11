'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { getSourceName } from '@/lib/utils/source-names';

/**
 * Split person names by common delimiters (comma, Chinese comma, slash).
 * Does NOT split by space — Chinese names contain no spaces, and splitting
 * by space would break English names like "Tom Hanks".
 */
function splitPersonNames(str: string): string[] {
  return str.split(/[,，/]/).map(s => s.trim()).filter(Boolean);
}

interface VideoMetadataProps {
  videoData: any;
  source: string | null;
  title?: string | null;
}

export function VideoMetadata({ videoData, source, title }: VideoMetadataProps) {
  return (
    <Card hover={false}>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {videoData?.vod_pic && (
          <img
            src={videoData.vod_pic}
            alt={videoData.vod_name}
            className="w-24 h-36 sm:w-32 sm:h-48 object-cover rounded-[var(--radius-2xl)] border border-[var(--glass-border)]"
          />
        )}
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--text-color)] mb-3">
            {videoData?.vod_name || title}
          </h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {source && (
              <Badge variant="primary" className="backdrop-blur-md">
                <Icons.Check size={14} className="mr-1" />
                {getSourceName(source)}
              </Badge>
            )}
            {videoData?.type_name && (
              <Badge variant="secondary">{videoData.type_name}</Badge>
            )}
            {videoData?.vod_year && (
              <Badge variant="secondary">
                <Icons.Calendar size={14} className="mr-1" />
                {videoData.vod_year}
              </Badge>
            )}
            {videoData?.vod_area && (
              <Badge variant="secondary">
                <Icons.Globe size={14} className="mr-1" />
                {videoData.vod_area}
              </Badge>
            )}
            {videoData?.vod_lang && (
              <Badge variant="secondary">
                <Icons.Languages size={14} className="mr-1" />
                {videoData.vod_lang}
              </Badge>
            )}
          </div>
          {videoData?.vod_content && (
            <p className="text-sm sm:text-base text-[var(--text-secondary)]">
              {videoData.vod_content.replace(/<[^>]*>/g, '')}
            </p>
          )}
          {videoData?.vod_actor && (
            <div className="text-xs sm:text-sm text-[var(--text-tertiary)] mt-2">
              <span className="font-semibold">主演：</span>
              <span className="inline-flex flex-wrap gap-1">
                {splitPersonNames(videoData.vod_actor).map((name) => (
                  <a
                    key={name}
                    href={`https://movie.douban.com/celebrities/search?search_text=${encodeURIComponent(name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all duration-200"
                  >
                    {name}
                    <Icons.ExternalLink size={10} />
                  </a>
                ))}
              </span>
            </div>
          )}
          {videoData?.vod_director && (
            <div className="text-xs sm:text-sm text-[var(--text-tertiary)] mt-1">
              <span className="font-semibold">导演：</span>
              <span className="inline-flex flex-wrap gap-1">
                {splitPersonNames(videoData.vod_director).map((name) => (
                  <a
                    key={name}
                    href={`https://movie.douban.com/celebrities/search?search_text=${encodeURIComponent(name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all duration-200"
                  >
                    {name}
                    <Icons.ExternalLink size={10} />
                  </a>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
