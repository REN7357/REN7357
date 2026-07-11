/**
 * AI 邮件模板优化 & 个性化文案生成
 */
import { callDeepSeek } from "./deepseek";

export interface GeneratedEmail {
  subject: string;
  body: string;
  type: "benefit" | "value";
}

export interface TemplateMetrics {
  openRate: number;
  replyRate: number;
  interestRate: number;
}

/**
 * 为特定达人生成个性化触达文案
 * @param templateType 模板类型: benefit(利益型) / value(价值型)
 * @param influencer 达人信息
 * @param productInfo 产品信息
 */
export async function generatePersonalizedEmail(
  templateType: "benefit" | "value",
  params: {
    name: string;
    platform: string;
    followers: number;
    contentStyle: string;
    tags: string[];
  },
  productInfo?: string
): Promise<GeneratedEmail> {
  const systemPrompt = `你是一位假发品牌的 BD 商务拓展专家。生成个性化的建联邮件。
邮件类型：${templateType === "benefit" ? "利益型 - 强调高佣金、免费寄样、投流支持" : "价值型 - 强调内容匹配、粉丝适配、爆款支持"}

要求：
- 语气真诚、个性化
- 引用达人的内容风格体现做了功课
- 突出 TEDHAIR 品牌优势（18年历史、工厂直供、美国仓库）
- 不要过于模板化
- 包含变量占位符 {{commission}}、{{contact}}
- 邮件主题简洁有力

输出格式：
主题：xxx
---
邮件正文内容`;

  const userMessage = JSON.stringify(
    {
      达人昵称: params.name,
      平台: params.platform,
      粉丝数: params.followers,
      内容风格: params.contentStyle,
      标签: params.tags,
      产品信息: productInfo || "假发/发束/发片全系列",
    },
    null,
    2
  );

  const text = await callDeepSeek(systemPrompt, userMessage, {
    temperature: 0.7,
    maxTokens: 1500,
  });

  // 解析输出
  const lines = text.split("\n");
  const subjectLine = lines.find((l) => l.startsWith("主题："));
  const subject = subjectLine?.replace("主题：", "").trim() || "";
  const bodyStart = text.indexOf("---");
  const body = bodyStart !== -1 ? text.slice(bodyStart + 3).trim() : text;

  return {
    subject: subject || `{{nickname}}，TEDHAIR 期待与您合作`,
    body,
    type: templateType,
  };
}

/**
 * AI 优化现有邮件模板
 */
export async function optimizeTemplate(
  currentTemplate: { subject: string; body: string },
  metrics: TemplateMetrics,
  recentReplies?: string[]
): Promise<{ subject: string; body: string; changes: string }> {
  const systemPrompt = `你是一位邮件营销优化专家。分析模板表现数据，优化邮件文案以提高回复率。
当前表现：
- 打开率: ${metrics.openRate}%
- 回复率: ${metrics.replyRate}%
- 意向率: ${metrics.interestRate}%

优化方向：
1. 标题更吸引人
2. 开头更个性化
3. 利益点更突出
4. 行动号召更明确

输出 JSON：
{
  "subject": "优化后的主题",
  "body": "优化后的正文",
  "changes": "改动说明"
}`;

  const text = await callDeepSeek(systemPrompt,
    `当前模板：\n主题：${currentTemplate.subject}\n\n正文：${currentTemplate.body}\n\n${recentReplies ? `近期回复：${JSON.stringify(recentReplies)}` : ""}`,
    { temperature: 0.4 }
  );

  try {
    return JSON.parse(text);
  } catch {
    return {
      subject: currentTemplate.subject,
      body: currentTemplate.body,
      changes: "AI 优化失败，保留原模板",
    };
  }
}

/**
 * 批量生成测试用的 A/B 模板
 */
export async function generateABTestTemplates(
  baseTemplate: { subject: string; body: string },
  count: number = 3
): Promise<GeneratedEmail[]> {
  const templates: GeneratedEmail[] = [];

  for (const type of ["benefit", "value"] as const) {
    const result = await generatePersonalizedEmail(
      type,
      {
        name: "{{nickname}}",
        platform: "{{platform}}",
        followers: 0,
        contentStyle: "{{style}}",
        tags: [],
      },
      "TEDHAIR 假发产品"
    );
    templates.push(result);
  }

  return templates;
}
