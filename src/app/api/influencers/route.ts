import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const influencers = await prisma.influencer.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(influencers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, platform, followers, sales30d, tags, email, sourceChannel, profileUrl } = body;

  if (!name || !platform) {
    return NextResponse.json({ error: "name and platform required" }, { status: 400 });
  }

  const influencer = await prisma.influencer.create({
    data: {
      name, platform,
      followers: followers || 0,
      sales30d: sales30d || 0,
      tags: JSON.stringify(tags || []),
      email, sourceChannel, profileUrl,
      status: "raw",
    },
  });

  return NextResponse.json(influencer, { status: 201 });
}
