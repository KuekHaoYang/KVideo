import type { VideoSource } from '@/lib/types';

const rawSources = [
  {
    "name": "电影天堂资源",
    "url": "http://caiji.dyttzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "如意资源",
    "url": "https://ruyiapi.com/api.php/provide/vod/"
  },
  {
    "name": "暴风资源",
    "url": "https://bfzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "非凡影视",
    "url": "https://cj.ffzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "爱奇艺资源",
    "url": "https://iqiyi.cdn2020.com/api.php/provide/vod/"
  },
  {
    "name": "卧龙资源",
    "url": "https://collect.wolongzyw.com/api.php/provide/vod/"
  },
  {
    "name": "极速资源",
    "url": "https://jszyapi.com/api.php/provide/vod/"
  },
  {
    "name": "豆瓣资源",
    "url": "https://dbzy.com/api.php/provide/vod/"
  },
  {
    "name": "魔爪资源",
    "url": "https://mozua.com/api.php/provide/vod/"
  },
  {
    "name": "魔都资源",
    "url": "https://moduzy.com/api.php/provide/vod/"
  },
  {
    "name": "最大资源",
    "url": "https://zuidazy.com/api.php/provide/vod/"
  },
  {
    "name": "百度云资源",
    "url": "https://api.bdzy.com/api.php/provide/vod/"
  },
  {
    "name": "无尽资源",
    "url": "https://api.wujinapi.me/api.php/provide/vod/"
  },
  {
    "name": "旺旺短剧",
    "url": "https://wwdj.com/api.php/provide/vod/"
  },
  {
    "name": "iKun 资源",
    "url": "https://ikunzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "量子资源",
    "url": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/"
  },
  {
    "name": "索尼资源",
    "url": "https://suoniapi.com/api.php/provide/vod/from/snm3u8/"
  },
  {
    "name": "红牛资源",
    "url": "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/"
  },
  {
    "name": "豪华资源",
    "url": "https://haohuazy.com/api.php/provide/vod/"
  },
  {
    "name": "闪电资源",
    "url": "https://sdzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "新浪资源",
    "url": "https://api.xinlangapi.com/api.php/provide/vod/"
  }
];

// Default predefined video sources - Real Chinese video APIs
export const DEFAULT_SOURCES: VideoSource[] = rawSources.map(s => ({
    id: s.name,
    name: s.name,
    baseUrl: s.url,
    searchPath: '',
    detailPath: '',
    enabled: true,
    group: 'normal'
}));
