/**
 * 爆款视频拆解 — 数据指标 + 评论分类 + AI 结构/洞察
 */
import { callDeepSeek, parseJSON } from "./deepseek";
import type { TikTokVideo, TikTokComment } from "@/lib/tiktok/scraper";

export interface VideoMetrics {
  engagementRate: number; // (赞+评+转+藏)/播放，%
  likeRate: number;
  commentRate: number;
  shareRate: number;
  saveRate: number;
  viewsPerFollower: number; // 播放/粉丝，>1 说明破圈
  grade: "S" | "A" | "B" | "C";
  drivers: string[]; // 一句话判断
}

export interface CommentStats {
  total: number; // 实际参与分类的条数（一级评论 + 回复）
  reported?: number; // TikTok 公布的总数
  topLevel?: number;
  replies?: number;
  categories: Record<string, { count: number; samples: string[] }>;
}

export interface VideoAIResult {
  summary: string; // 一句话本质
  hook: string; // 0-3 秒钩子判断
  structure: { segment: string; content: string; purpose: string }[];
  viralDrivers: string[]; // 爆的原因
  commentInsights: { theme: string; share: string; evidence: string }[];
  audienceNeeds: string[]; // 用户真正在意的点
  conversionGaps: string[]; // 转化漏点
  risks: string[]; // 产品/口碑风险
  actions: string[]; // 可执行建议
  influencerFit: { score: number; reason: string }; // 达人合作价值 0-100
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : 0);

export function computeMetrics(video: TikTokVideo): VideoMetrics {
  const { views, likes, comments, shares, saves } = video.stats;
  const m = {
    engagementRate: pct(likes + comments + shares + saves, views),
    likeRate: pct(likes, views),
    commentRate: pct(comments, views),
    shareRate: pct(shares, views),
    saveRate: pct(saves, views),
    viewsPerFollower:
      video.authorFollowers > 0 ? Math.round((views / video.authorFollowers) * 10) / 10 : 0,
  };

  const drivers: string[] = [];
  if (m.likeRate >= 10) drivers.push("点赞率极高：视觉/情绪驱动型内容");
  if (m.saveRate >= 1) drivers.push("收藏率高：用户当作参考/种草清单");
  if (m.shareRate >= 1) drivers.push("分享率高：有社交货币，适合铺量模仿");
  if (m.commentRate >= 0.5) drivers.push("评论率高：有争议或疑问，适合承接转化");
  if (m.commentRate < 0.1) drivers.push("评论率低：讨论度弱，靠观感而非话题");
  if (m.viewsPerFollower >= 5) drivers.push(`播放是粉丝的 ${m.viewsPerFollower} 倍：已破圈`);

  const grade =
    m.engagementRate >= 15 ? "S" : m.engagementRate >= 8 ? "A" : m.engagementRate >= 4 ? "B" : "C";

  return { ...m, grade, drivers };
}

// 关键词分类（无 AI 也能出结果，且给 AI 提供量化依据）
const CATEGORY_RULES: [string, RegExp][] = [
  ["负面/质疑", /\b(smell|shed|shedding|tangle|fake|scam|bad|worst|return(ed)?|refund|cheap|ugly|not worth|overpriced)\b|退货|差|假|掉发|打结|味道/i],
  ["价格讨论", /\$\s?\d|\b\d+(\.\d+)?k\b|\b(how much|price|pricing|cost|pay|paid|expensive|afford|worth)\b|多少钱|价格|贵/i],
  ["购买意向", /\b(link|where.*(buy|get|find)|buy|purchase|order|book|booking|appointment|located|location|drop the info|info|wya|where (is|are|she|u|you))\b|链接|哪里买|怎么买/i],
  ["产品细节提问", /\b(what|which)\s+(color|colour|inch|length|brand|hair|bundle|closure|frontal|wig|size|shade)\b|\b(color|inch|length|closure|leave ?out|bundle|density|1b|27|30|613|\d{2}\s?(inch|in|"))\b|色号|几寸|长度|尺码|什么牌/i],
  ["痛点/需求共鸣", /\b(i need|need this|i want|want this|me in|wish|can'?t wait|gotta|show my stylist|my stylist)\b|想要|需要|求/i],
];

export function categorizeComments(comments: TikTokComment[]): CommentStats {
  // 回复同样代表用户声音（如“求链接”多出现在热评回复里），一并分类
  const all = comments.flatMap((c) => [c, ...(c.replies || []).map((r) => ({ ...r, replyCount: 0, cid: "" }))]);
  const categories: CommentStats["categories"] = {};
  for (const [name] of CATEGORY_RULES) categories[name] = { count: 0, samples: [] };
  categories["夸赞/情绪"] = { count: 0, samples: [] };

  for (const c of all) {
    const text = c.text.trim();
    if (!text) continue;
    const hit = CATEGORY_RULES.find(([, re]) => re.test(text));
    const cat = categories[hit ? hit[0] : "夸赞/情绪"];
    cat.count++;
    if (cat.samples.length < 5) cat.samples.push(text.slice(0, 150)); // comments 已按赞排序
  }
  return { total: all.filter((c) => c.text.trim()).length, categories };
}

const SYSTEM_PROMPT = `你是跨境电商内容分析专家，服务于假发品牌 TEDHAIR 的达人 BD 团队。
根据 TikTok 视频的元数据、互动指标、评论统计和高赞评论（含回复），拆解这条视频为什么火、评论里用户在意什么、对品牌合作有什么启示。
你看不到画面，视频结构请基于文案、时长、音乐、标签和评论中对画面的描述合理推断，不确定时注明“推断”。
只输出 JSON：
{
  "summary": "一句话说清这条视频火的本质",
  "hook": "0-3秒钩子的类型与判断",
  "structure": [{"segment": "0-3s 钩子", "content": "画面/内容", "purpose": "作用"}],
  "viralDrivers": ["爆的原因，按重要性排序，引用评论证据"],
  "commentInsights": [{"theme": "评论主题", "share": "约占比", "evidence": "代表性原话"}],
  "audienceNeeds": ["用户真正在意的点"],
  "conversionGaps": ["流量没有变成订单的漏点"],
  "risks": ["产品/口碑风险"],
  "actions": ["给 BD 和内容团队的可执行建议，3-5条"],
  "influencerFit": {"score": 80, "reason": "该达人对假发品牌的合作价值 0-100 及理由"}
}
要求：简洁，抓本质；高赞评论（尤其第一热评及其回复）往往揭示流量来源，必须重点解读。`;

export async function analyzeVideoWithAI(
  video: TikTokVideo,
  metrics: VideoMetrics,
  stats: CommentStats,
  comments: TikTokComment[]
): Promise<VideoAIResult | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const userMessage = JSON.stringify(
    {
      视频: {
        作者: video.author,
        作者粉丝: video.authorFollowers,
        文案: video.description,
        标签: video.hashtags,
        提及账号: video.mentions,
        音乐: video.music,
        时长秒: video.duration,
        发布时间: video.postedAt,
      },
      数据: video.stats,
      指标: metrics,
      评论分类统计: Object.fromEntries(
        Object.entries(stats.categories).map(([k, v]) => [k, v.count])
      ),
      高赞评论: comments.slice(0, 60).map((c) => ({
        text: c.text,
        likes: c.likes,
        replies: c.replies?.slice(0, 10).map((r) => `${r.text} (${r.likes}赞)`),
      })),
    },
    null,
    2
  );

  const text = await callDeepSeek(SYSTEM_PROMPT, userMessage, {
    temperature: 0.3,
    maxTokens: 3000,
  });
  return parseJSON(text) as VideoAIResult;
}
