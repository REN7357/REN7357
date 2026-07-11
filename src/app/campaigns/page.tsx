import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    include: { channel: true, template: true, _count: { select: { influencers: true, outreaches: true } } },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    running: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaign 管理</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ 新建 Campaign</button>
      </div>

      <div className="grid gap-4">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{c.description || "-"}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[c.status] || ""}`}>{c.status}</span>
            </div>
            <div className="flex gap-6 mt-4 text-sm text-gray-500">
              <span>渠道: {c.channel?.label || "-"}</span>
              <span>模板: {c.template?.name || "-"}</span>
              <span>达人: {c._count.influencers}</span>
              <span>触达: {c._count.outreaches}</span>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-gray-400 text-center py-12">暂无 Campaign</p>}
      </div>
    </div>
  );
}
