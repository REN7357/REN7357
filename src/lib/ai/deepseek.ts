/**
 * DeepSeek API 客户端（兼容 OpenAI SDK）
 */
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

export async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
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
    // 尝试直接解析
    return JSON.parse(text);
  } catch {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }
    // 尝试找第一个 { 到最后一个 }
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {}
    }
    throw new Error("无法解析 AI 输出为 JSON");
  }
}
