/**
 * AI 达人分析 — 自动打标签 + 内容评估
 */
import { callDeepSeek, parseJSON } from "./deepseek";

export interface AITagResult {
  tags: string[];
  style: string;          // 内容风格
  relevance: number;      // 与假发品类相关度 0-100
  recommendation: string; // 合作建议
  reason: string;         // 判断依据
}

const SYSTEM_PROMPT = `你是一位假发行业的 BD 专家。分析达人数据，输出 JSON：
{
  "tags": ["标签1", "标签2"],       // 最多5个内容标签
  "style": "内容风格描述",           // 一句话概括
  "relevance": 85,                   // 与假发品类相关度 0-100
  "recommendation": "合作建议",      // 是否建议合作及理由
  "reason": "判断依据"               // 简要分析原因
}

行业知识：
- TEDHAIR 是假发品牌，主营假发、发束、发片
- 目标客户：需要假发/发型的女性消费者
- 适合达人：发型师、美妆博主、时尚穿搭博主
- 允许内容方向：假发、发型、美妆、时尚、穿搭
- 拒绝内容方向：美食、宠物、游戏、搞笑`;

export async function analyzeInfluencer(params: {
  name: string;
  platform: string;
  followers: number;
  sales30d: number;
  tags: string[];
  recentVideos?: { title: string; tags?: string[] }[];
}): Promise<AITagResult> {
  const userMessage = JSON.stringify(
    {
      达人昵称: params.name,
      平台: params.platform,
      粉丝数: params.followers,
      近30天销量: params.sales30d,
      现有标签: params.tags,
      近期内容: (params.recentVideos || []).slice(0, 10).map((v) => ({
        title: v.title,
        tags: v.tags || [],
      })),
    },
    null,
    2
  );

  const text = await callDeepSeek(SYSTEM_PROMPT, userMessage, {
    temperature: 0.3,
  });

  return parseJSON(text) as AITagResult;
}

/**
 * 批量分析并更新达人数据
 */
export async function batchAnalyzeInfluencers(
  influencers: any[]
): Promise<{ updated: number }> {
  let updated = 0;
  for (const inf of influencers) {
    try {
      const recentVideos = inf.recentVideos
        ? JSON.parse(inf.recentVideos)
        : [];
      const tags = JSON.parse(inf.tags || "[]");

      const result = await analyzeInfluencer({
        name: inf.name,
        platform: inf.platform,
        followers: inf.followers,
        sales30d: inf.sales30d,
        tags,
        recentVideos,
      });

      // 更新到达人记录
      // 这里由调用方处理数据库更新
      updated++;
    } catch (err) {
      console.error(`AI 分析失败: ${inf.name}`, err);
    }
  }
  return { updated };
}
