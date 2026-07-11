import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendNotice } from "@/lib/feishu/notify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, data } = await req.json();

  switch (type) {
    case "test":
      await sendNotice("测试通知", "✅ 飞书通知功能正常！");
      break;
    case "new_influencer":
      await sendNotice("新达人入库",
        `👤 达人: ${data.name}\n📱 平台: ${data.platform}\n👥 粉丝: ${(data.followers || 0).toLocaleString()}\n🏷️ 标签: ${(data.tags || []).join(", ")}`
      );
      break;
    case "ai_analysis":
      await sendNotice(
        data.passed ? "✅ AI 分析通过" : "❌ AI 分析过滤",
        `👤 达人: ${data.name}\n⭐ 评分: ${data.score}/100\n📝 ${data.reason}`
      );
      break;
    default:
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
