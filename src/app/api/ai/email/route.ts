import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePersonalizedEmail } from "@/lib/ai/emailGenerator";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { influencerId, templateType } = await req.json();
  const type = templateType || "benefit";

  const inf = await prisma.influencer.findUnique({
    where: { id: influencerId },
  });

  if (!inf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = JSON.parse(inf.tags || "[]");

  const email = await generatePersonalizedEmail(type, {
    name: inf.name,
    platform: inf.platform,
    followers: inf.followers,
    contentStyle: inf.aiSummary || "时尚内容",
    tags,
  });

  return NextResponse.json({
    name: inf.name,
    platform: inf.platform,
    ...email,
  });
}
