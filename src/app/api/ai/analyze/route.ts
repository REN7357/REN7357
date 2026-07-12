import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { influencerId } = await req.json();
  if (!influencerId) {
    return NextResponse.json({ error: "influencerId required" }, { status: 400 });
  }

  // Lazy load AI module only at runtime
  const { analyzeInfluencer } = await import("@/lib/ai/influencerAnalysis");

  const inf = await prisma.influencer.findUnique({ where: { id: influencerId } });
  if (!inf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tags = JSON.parse(inf.tags || "[]");
  const recentVideos = inf.recentVideos ? JSON.parse(inf.recentVideos) : [];

  try {
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
        filterReason: result.relevance < 50 ? result.reason : null,
        filterCategory: result.relevance < 50 ? "内容过滤" : null,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: `AI分析失败: ${err.message}` }, { status: 500 });
  }
}
