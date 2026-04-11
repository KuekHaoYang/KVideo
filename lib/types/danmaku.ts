export interface DanmakuComment {
  text: string;
  time: number; // seconds from video start
  color?: string; // hex color, default white
  type?: 'scroll' | 'top' | 'bottom'; // default 'scroll'
}

export interface DanmakuEpisode {
  episodeId: string | number;
  episodeTitle: string;
}

export interface DanmakuSearchResult {
  animeId: string | number;
  animeTitle: string;
  episodes: DanmakuEpisode[];
}
