import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { filterInfluencer, analyzeCommonTraits } from "@/lib/ai/filterEngine";

// Run AI filter on all raw influencers
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawInfluencers = await prisma.influencer.findMany({
    where: { status: "raw" },
  });

  let passed = 0;
  let filtered = 0;

  for (const inf of rawInfluencers) {
    const tags = JSON.parse(inf.tags || "[]");
    const result = filterInfluencer({
      name: inf.name,
      platform: inf.platform,
      followers: inf.followers,
      sales30d: inf.sales30d,
      tags,
    });

    if (result.passed) {
      await prisma.influencer.update({
        where: { id: inf.id },
        data: {
          status: "passed",
          allowedTags: JSON.stringify(result.matchedAllowedTags),
          rejectedTags: JSON.stringify(result.matchedRejectedTags),
          aiSummary: `评分: ${result.score}/100`,
        },
      });
      passed++;
    } else {
      await prisma.influencer.update({
        where: { id: inf.id },
        data: {
          status: "filtered",
          filterReason: result.filterReason,
          filterCategory: result.filterCategory,
          allowedTags: JSON.stringify(result.matchedAllowedTags),
          rejectedTags: JSON.stringify(result.matchedRejectedTags),
          aiSummary: result.filterReason,
        },
      });
      filtered++;
    }
  }

  return NextResponse.json({ processed: rawInfluencers.length, passed, filtered });
}

// Run AI iteration report
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const passedInfluencers = await prisma.influencer.findMany({
    where: { status: "passed" },
  });

  const data = passedInfluencers.map((inf) => ({
    name: inf.name,
    platform: inf.platform,
    followers: inf.followers,
    sales30d: inf.sales30d,
    tags: JSON.parse(inf.tags || "[]"),
  }));

  const analysis = analyzeCommonTraits(data);

  return NextResponse.json({
    totalPassed: passedInfluencers.length,
    ...analysis,
    suggestion: `优质达人集中在${analysis.commonPlatforms.join("/")}平台，高频标签为${analysis.commonTags.slice(0, 5).join("、")}`,
  });
}
