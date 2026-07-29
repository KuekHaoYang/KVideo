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
  },
  {
    "name": "360资源",
    "url": "https://360zy.com/api.php/provide/vod/"
  },
  {
    "name": "非凡资源",
    "url": "https://ffzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "光速资源",
    "url": "https://api.guangsuapi.com/api.php/provide/vod/"
  },
  {
    "name": "飞速资源",
    "url": "https://www.feisuzy.com/api.php/provide/vod/"
  },
  {
    "name": "优酷资源",
    "url": "https://api.youkuapi.com/api.php/provide/vod/"
  },
  {
    "name": "腾讯资源",
    "url": "https://api.tencentyun.com/api.php/provide/vod/"
  },
  {
    "name": "芒果资源",
    "url": "https://api.mgtv.com/api.php/provide/vod/"
  },
  {
    "name": "快车资源",
    "url": "https://caiji.kuaichezy.com/api.php/provide/vod/"
  },
  {
    "name": "百度资源",
    "url": "https://api.apibdzy.com/api.php/provide/vod/"
  },
  {
    "name": "樱花资源",
    "url": "https://m3u8.apiyhzy.com/api.php/provide/vod/"
  },
  {
    "name": "精品资源",
    "url": "https://www.jingpinzy.com/api.php/provide/vod/"
  },
  {
    "name": "神马资源",
    "url": "https://img.smdy.cc/api.php/provide/vod/"
  },
  {
    "name": "天空资源",
    "url": "https://api.tiankongapi.com/api.php/provide/vod/"
  },
  {
    "name": "星辰资源",
    "url": "https://api.xingchenzy.com/api.php/provide/vod/"
  },
  {
    "name": "飘零资源",
    "url": "https://p2100.net/api.php/provide/vod/"
  },
  {
    "name": "1080P资源",
    "url": "https://api.1080zy.com/api.php/provide/vod/"
  },
  {
    "name": "黑木耳资源",
    "url": "https://json.heimuer.tv/api.php/provide/vod/"
  },
  {
    "name": "旺旺资源",
    "url": "https://api.wwzy.com/api.php/provide/vod/"
  },
  {
    "name": "金鹰资源",
    "url": "https://jyzyapi.com/api.php/provide/vod/"
  },
  {
    "name": "阳光资源",
    "url": "https://api.yangguang.com/api.php/provide/vod/"
  },
  {
    "name": "酷点资源",
    "url": "https://kudianzy.com/api.php/provide/vod/"
  },
  {
    "name": "风暴资源",
    "url": "https://fengbao.com/api.php/provide/vod/"
  },
  {
    "name": "人人资源",
    "url": "https://renrenzy.com/api.php/provide/vod/"
  },
  {
    "name": "美剧资源",
    "url": "https://meijuzy.com/api.php/provide/vod/"
  },
  {
    "name": "韩剧资源",
    "url": "https://hanjuzy.com/api.php/provide/vod/"
  },
  {
    "name": "日剧资源",
    "url": "https://rijuzy.com/api.php/provide/vod/"
  },
  {
    "name": "动漫资源",
    "url": "https://dmzy.com/api.php/provide/vod/"
  },
  {
    "name": "4K资源",
    "url": "https://4kzy.com/api.php/provide/vod/"
  },
  {
    "name": "纪录片资源",
    "url": "https://jlpzy.com/api.php/provide/vod/"
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
