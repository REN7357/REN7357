import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientPage from "./client";

export default async function InfluencersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [influencers, channels] = await Promise.all([
    prisma.influencer.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.channel.findMany({ where: { isActive: true } }),
  ]);

  const stats = {
    total: await prisma.influencer.count(),
    raw: await prisma.influencer.count({ where: { status: "raw" } }),
    passed: await prisma.influencer.count({ where: { status: "passed" } }),
    filtered: await prisma.influencer.count({ where: { filterReason: { not: null } } }),
  };

  return <ClientPage influencers={JSON.parse(JSON.stringify(influencers))} channels={JSON.parse(JSON.stringify(channels))} stats={stats} />;
}
