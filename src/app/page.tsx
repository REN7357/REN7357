import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [
    totalInfluencers,
    passedCount,
    repliedCount,
    interestedCount,
    recentOutreach,
    activeCampaigns,
  ] = await Promise.all([
    prisma.influencer.count(),
    prisma.influencer.count({ where: { status: "passed" } }),
    prisma.outreach.count({ where: { status: "replied" } }),
    prisma.outreach.count({ where: { status: "interested" } }),
    prisma.outreach.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { influencer: true, template: true } }),
    prisma.campaign.count({ where: { status: "running" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">数据看板</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "达人池总量", value: totalInfluencers, color: "text-blue-600" },
          { label: "已通过达人", value: passedCount, color: "text-green-600" },
          { label: "已回复数", value: repliedCount, color: "text-purple-600" },
          { label: "高意向数", value: interestedCount, color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white p-5 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">进行中 Campaign</p>
          <p className="text-2xl font-bold mt-1">{activeCampaigns}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">回复率</p>
          <p className="text-2xl font-bold mt-1">
            {totalInfluencers > 0
              ? `${((repliedCount / totalInfluencers) * 100).toFixed(1)}%`
              : "0%"}
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">最近触达记录</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600">达人</th>
              <th className="text-left px-4 py-3 text-gray-600">模板</th>
              <th className="text-left px-4 py-3 text-gray-600">状态</th>
              <th className="text-left px-4 py-3 text-gray-600">时间</th>
            </tr>
          </thead>
          <tbody>
            {recentOutreach.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{o.influencer.name}</td>
                <td className="px-4 py-3 text-gray-500">{o.template?.name || "-"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(o.sentAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
