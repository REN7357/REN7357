import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientPage from "./client";

export default async function ContentAnalysisPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [analyses, influencers] = await Promise.all([
    prisma.videoAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { influencer: { select: { id: true, name: true } } },
    }),
    prisma.influencer.findMany({
      where: { platform: "tiktok" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <ClientPage analyses={JSON.parse(JSON.stringify(analyses))} influencers={influencers} />;
}
