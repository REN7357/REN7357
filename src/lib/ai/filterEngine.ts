/**
 * AI 自动标签 & 三层过滤引擎
 * 规则：
 *   - 允许标签：假发、发型、美妆、时尚、穿搭、生活、职场、母婴、配饰
 *   - 拒绝标签：美食、宠物、游戏、搞笑、剧情、科技、汽车、体育、知识、家居、手工、萌宠、美食教程
 *
 * 三层过滤：
 *   1. 基础过滤：粉丝数、地域
 *   2. 内容过滤：拒绝标签占比
 *   3. 带货过滤：近30天无挂车/无销量
 */

export interface InfluencerData {
  name: string;
  platform: string;
  followers: number;
  sales30d: number;
  tags: string[];       // 原始标签
  recentVideos?: {      // 最近视频信息
    title: string;
    tags: string[];
    hasShopLink?: boolean;
  }[];
}

export interface FilterResult {
  passed: boolean;
  status: "passed" | "filtered";
  filterReason?: string;
  filterCategory?: "基础过滤" | "内容过滤" | "带货过滤";
  matchedAllowedTags: string[];
  matchedRejectedTags: string[];
  score: number;
}

const ALLOWED_TAGS = new Set([
  "假发", "发型", "美妆", "时尚", "穿搭", "生活", "职场", "母婴", "配饰",
]);

const REJECTED_TAGS = new Set([
  "美食", "宠物", "游戏", "搞笑", "剧情", "科技", "汽车", "体育",
  "知识", "家居", "手工", "萌宠", "美食教程",
]);

/** 三层过滤主函数 */
export function filterInfluencer(data: InfluencerData): FilterResult {
  const matchedAllowed = data.tags.filter((t) => ALLOWED_TAGS.has(t));
  const matchedRejected = data.tags.filter((t) => REJECTED_TAGS.has(t));

  // 第一层：基础过滤
  if (data.followers < 1000) {
    return {
      passed: false,
      status: "filtered",
      filterReason: `粉丝数过低: ${data.followers}`,
      filterCategory: "基础过滤",
      matchedAllowedTags: matchedAllowed,
      matchedRejectedTags: matchedRejected,
      score: 0,
    };
  }

  // 第二层：内容过滤
  if (data.tags.length > 0) {
    const rejectRatio = matchedRejected.length / data.tags.length;
    if (rejectRatio >= 0.5) {
      return {
        passed: false,
        status: "filtered",
        filterReason: `拒绝标签占比过高: ${(rejectRatio * 100).toFixed(0)}%`,
        filterCategory: "内容过滤",
        matchedAllowedTags: matchedAllowed,
        matchedRejectedTags: matchedRejected,
        score: Math.round((1 - rejectRatio) * 100),
      };
    }
  }

  // 第三层：带货过滤（近30天无销量）
  if (data.sales30d === 0 && matchedAllowed.length === 0) {
    return {
      passed: false,
      status: "filtered",
      filterReason: "近30天无销量且无匹配标签",
      filterCategory: "带货过滤",
      matchedAllowedTags: matchedAllowed,
      matchedRejectedTags: matchedRejected,
      score: 10,
    };
  }

  // 通过：计算综合评分
  const score = Math.min(100, Math.round(
    (matchedAllowed.length * 20) +
    Math.min(data.followers / 10000, 30) +
    Math.min(data.sales30d / 10, 20)
  ));

  return {
    passed: true,
    status: "passed",
    matchedAllowedTags: matchedAllowed,
    matchedRejectedTags: matchedRejected,
    score,
  };
}

/** 分析优质达人的共性（用于AI反哺迭代） */
export function analyzeCommonTraits(
  passedInfluencers: InfluencerData[]
): {
  commonTags: string[];
  avgFollowers: number;
  avgSales: number;
  commonPlatforms: string[];
} {
  const tagCount = new Map<string, number>();
  const platformCount = new Map<string, number>();
  let totalFollowers = 0;
  let totalSales = 0;

  for (const inf of passedInfluencers) {
    for (const tag of inf.tags) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
    platformCount.set(inf.platform, (platformCount.get(inf.platform) || 0) + 1);
    totalFollowers += inf.followers;
    totalSales += inf.sales30d;
  }

  const sortedTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const sortedPlatforms = [...platformCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);

  return {
    commonTags: sortedTags,
    avgFollowers: passedInfluencers.length > 0 ? Math.round(totalFollowers / passedInfluencers.length) : 0,
    avgSales: passedInfluencers.length > 0 ? Math.round(totalSales / passedInfluencers.length) : 0,
    commonPlatforms: sortedPlatforms,
  };
}
