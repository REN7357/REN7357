import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Run dedup against the existing influencer pool
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawInfluencers = await prisma.influencer.findMany({
    where: { status: "raw" },
  });

  const existingInfluencers = await prisma.influencer.findMany({
    where: { status: { not: "raw" } },
    select: { name: true, platformId: true, email: true },
  });

  const existingNames = new Set(existingInfluencers.map((e) => e.name.toLowerCase()));
  const existingPlatformIds = new Set(
    existingInfluencers.filter((e) => e.platformId).map((e) => e.platformId)
  );
  const existingEmails = new Set(
    existingInfluencers.filter((e) => e.email).map((e) => e.email!.toLowerCase())
  );

  let deduped = 0;

  for (const inf of rawInfluencers) {
    let matched = false;
    let matchedField = "";
    let matchedValue = "";

    if (existingNames.has(inf.name.toLowerCase())) {
      matched = true;
      matchedField = "name";
      matchedValue = inf.name;
    } else if (inf.platformId && existingPlatformIds.has(inf.platformId)) {
      matched = true;
      matchedField = "platformId";
      matchedValue = inf.platformId;
    } else if (inf.email && existingEmails.has(inf.email.toLowerCase())) {
      matched = true;
      matchedField = "email";
      matchedValue = inf.email;
    }

    if (matched) {
      await prisma.dedupLog.create({
        data: {
          influencerId: inf.id,
          influencerName: inf.name,
          platformId: inf.platformId,
          platform: inf.platform,
          matchedField,
          matchedValue,
          sourceList: "existing",
        },
      });

      await prisma.influencer.update({
        where: { id: inf.id },
        data: { status: "deduped", filterReason: `重复: ${matchedField}=${matchedValue}` },
      });
      deduped++;
    }
  }

  return NextResponse.json({ total: rawInfluencers.length, deduped, remaining: rawInfluencers.length - deduped });
}
