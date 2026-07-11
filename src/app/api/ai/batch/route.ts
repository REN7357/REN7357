import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { batchAnalyzeInfluencers } from "@/lib/ai/influencerAnalysis";
import { generateABTestTemplates } from "@/lib/ai/emailGenerator";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();

  if (action === "batch-analyze") {
    // 批量分析所有 raw 状态的达人
    const rawInfluencers = await prisma.influencer.findMany({
      where: { status: "raw" },
    });

    let passed = 0;
    let filtered = 0;

    for (const inf of rawInfluencers) {
      try {
        const tags = JSON.parse(inf.tags || "[]");
        const recentVideos = inf.recentVideos
          ? JSON.parse(inf.recentVideos)
          : [];

        const { analyzeInfluencer } = await import(
          "@/lib/ai/influencerAnalysis"
        );
        const result = await analyzeInfluencer({
          name: inf.name,
          platform: inf.platform,
          followers: inf.followers,
          sales30d: inf.sales30d,
          tags,
          recentVideos,
        });

        await prisma.influencer.update({
          where: { id: inf.id },
          data: {
            tags: JSON.stringify(result.tags),
            allowedTags: JSON.stringify(result.tags),
            aiSummary: result.reason,
            status: result.relevance >= 50 ? "passed" : "filtered",
            filterReason:
              result.relevance < 50 ? result.reason : null,
            filterCategory:
              result.relevance < 50 ? "内容过滤" : null,
          },
        });

        if (result.relevance >= 50) passed++;
        else filtered++;
      } catch (err) {
        console.error(`分析失败: ${inf.name}`, err);
      }
    }

    return NextResponse.json({ total: rawInfluencers.length, passed, filtered });
  }

  if (action === "generate-templates") {
    // 生成 A/B 测试模板
    const templates = await generateABTestTemplates(
      { subject: "", body: "" },
      2
    );

    // 保存到数据库
    for (const t of templates) {
      await prisma.emailTemplate.create({
        data: {
          name: `AI 生成 - ${t.type === "benefit" ? "利益型" : "价值型"} ${new Date().toLocaleDateString()}`,
          type: t.type,
          subject: t.subject,
          body: t.body,
          version: 1,
        },
      });
    }

    return NextResponse.json({ created: templates.length, templates });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
