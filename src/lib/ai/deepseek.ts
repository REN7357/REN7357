/**
 * DeepSeek API 客户端（兼容 OpenAI SDK）
 * 使用动态 import 避免构建时的依赖问题
 */

const API_KEY = process.env.DEEPSEEK_API_KEY || "";

export async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!API_KEY) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  // 动态 import 仅在运行时加载
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: API_KEY,
  });

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * 安全的 JSON 解析（AI 回复可能格式不规范）
 */
export function parseJSON(text: string): Record<string, any> {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch {}
    }
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      try { return JSON.parse(text.slice(first, last + 1)); } catch {}
    }
    throw new Error("无法解析 AI 输出为 JSON");
  }
}
