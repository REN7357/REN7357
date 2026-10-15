import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 抓取 + AI 分析耗时较长
export const maxDuration = 120;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.videoAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { influencer: { select: { id: true, name: true } } },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, influencerId } = await req.json();
  if (!url || !/tiktok\.com/.test(url)) {
    return NextResponse.json({ error: "请提供 TikTok 视频链接" }, { status: 400 });
  }

  const { fetchTikTokVideo, fetchTikTokComments } = await import("@/lib/tiktok/scraper");
  const { computeMetrics, categorizeComments, analyzeVideoWithAI } = await import(
    "@/lib/ai/videoAnalysis"
  );

  let video, cookies;
  try {
    ({ video, cookies } = await fetchTikTokVideo(url));
  } catch (err: any) {
    return NextResponse.json({ error: `视频抓取失败: ${err.message}` }, { status: 502 });
  }

  // 评论抓取失败时仍保留视频数据分析
  let fetched: Awaited<ReturnType<typeof fetchTikTokComments>> | null = null;
  let commentError: string | null = null;
  try {
    fetched = await fetchTikTokComments(video, cookies);
  } catch (err: any) {
    commentError = `评论抓取失败: ${err.message}`;
  }
  const comments = fetched?.comments || [];

  const metrics = computeMetrics(video);
  const commentStats = {
    ...categorizeComments(comments),
    reported: fetched?.reported ?? video.stats.comments,
    topLevel: fetched?.topLevel ?? 0,
    replies: fetched?.replies ?? 0,
  };

  let result = null;
  let aiError: string | null = null;
  try {
    result = await analyzeVideoWithAI(video, metrics, commentStats, comments);
    if (!result) aiError = "未配置 DEEPSEEK_API_KEY，仅输出数据指标与评论分类";
  } catch (err: any) {
    aiError = `AI 分析失败: ${err.message}`;
  }

  // 未指定达人时，按 TikTok 账号自动关联已有达人
  const linkedId =
    influencerId ||
    (
      await prisma.influencer.findFirst({
        where: {
          platform: "tiktok",
          OR: [{ platformId: video.author }, { name: video.author }],
        },
        select: { id: true },
      })
    )?.id ||
    null;

  const record = await prisma.videoAnalysis.create({
    data: {
      url: video.url,
      videoId: video.videoId,
      author: video.author,
      authorFollowers: video.authorFollowers,
      description: video.description,
      hashtags: JSON.stringify(video.hashtags),
      mentions: JSON.stringify(video.mentions),
      music: video.music,
      duration: video.duration,
      postedAt: video.postedAt,
      ...video.stats,
      metrics: JSON.stringify(metrics),
      commentStats: JSON.stringify(commentStats),
      topComments: JSON.stringify(
        comments.slice(0, 30).map((c) => ({ ...c, replies: c.replies?.slice(0, 10) }))
      ),
      result: result ? JSON.stringify(result) : null,
      errorMsg: [commentError, aiError].filter(Boolean).join("；") || null,
      influencerId: linkedId,
      createdBy: session.user?.id,
    },
    include: { influencer: { select: { id: true, name: true } } },
  });

  // 写回达人近期内容，供达人 AI 打标/筛选使用
  if (linkedId) {
    const inf = await prisma.influencer.findUnique({ where: { id: linkedId } });
    if (inf) {
      const recent = JSON.parse(inf.recentVideos || "[]").filter(
        (v: any) => v.videoId !== video.videoId
      );
      recent.unshift({
        videoId: video.videoId,
        title: video.description,
        tags: video.hashtags,
        views: video.stats.views,
        engagementRate: metrics.engagementRate,
      });
      await prisma.influencer.update({
        where: { id: linkedId },
        data: { recentVideos: JSON.stringify(recent.slice(0, 20)), updatedAt: new Date() },
      });
    }
  }

  return NextResponse.json(record);
}
