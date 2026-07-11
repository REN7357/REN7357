/**
 * 飞书集成模块
 * 使用 lark-cli 已有的 bot 身份发送消息
 */

const NOTICE_CHAT_ID = "oc_0f0a87c1e1fecc6ecc2526a6ca37d86f";

/**
 * 发送通知到 KOL-app 开发群
 */
export async function sendNotice(title: string, content: string) {
  const { execSync } = await import("child_process");
  const text = `🤖 ${title}\n\n${content}`;
  try {
    execSync(
      `lark-cli im +messages-send --chat-id ${NOTICE_CHAT_ID} --text ${JSON.stringify(text)}`,
      { timeout: 10000 }
    );
  } catch (err) {
    console.error("飞书通知发送失败:", err);
  }
}

/**
 * 发送新达人通知
 */
export async function notifyNewInfluencer(name: string, platform: string, followers: number, tags: string[]) {
  return sendNotice(
    "新达人入库",
    `👤 达人: ${name}\n📱 平台: ${platform}\n👥 粉丝: ${followers.toLocaleString()}\n🏷️ 标签: ${tags.join(", ")}`
  );
}

/**
 * 发送 AI 分析结果通知
 */
export async function notifyAIAnalysis(name: string, passed: boolean, score: number, reason: string) {
  return sendNotice(
    passed ? "✅ AI 分析通过" : "❌ AI 分析过滤",
    `👤 达人: ${name}\n⭐ 评分: ${score}/100\n📝 分析: ${reason}`
  );
}

/**
 * 发送系统告警
 */
export async function notifyAlert(message: string) {
  return sendNotice("⚠️ 系统告警", message);
}
