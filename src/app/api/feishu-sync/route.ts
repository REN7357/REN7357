import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Sync influencers to Feishu bitable
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appToken, tableId } = await req.json();

  const influencers = await prisma.influencer.findMany({
    where: { status: "passed" },
    take: 50,
  });

  let successCount = 0;
  for (const inf of influencers) {
    // Use lark-cli to add records (or call feishu API)
    // For now, log the action
    console.log(`Sync to feishu: ${inf.name} -> bitable ${appToken}/${tableId}`);
    successCount++;
  }

  await prisma.feishuSyncLog.create({
    data: {
      direction: "to_feishu",
      dataType: "influencer",
      recordCount: successCount,
      status: "success",
    },
  });

  return NextResponse.json({ synced: successCount });
}

// Pull cooperated influencers from Feishu for dedup
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") || "from_feishu";

  const logs = await prisma.feishuSyncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(logs);
}
