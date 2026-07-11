import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OutreachPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [passedInfluencers, templates, campaigns] = await Promise.all([
    prisma.influencer.findMany({ where: { status: "passed" }, take: 50 }),
    prisma.emailTemplate.findMany({ where: { isActive: true } }),
    prisma.campaign.findMany({ where: { status: { in: ["draft", "running"] } } }),
  ]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">批量触达</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Send Panel */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="font-semibold text-lg mb-4">发送触达</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择 Campaign</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">-- 直接发送（无 Campaign）--</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择邮件模板</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">请选择模板</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                已通过达人 ({passedInfluencers.length} 人)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {passedInfluencers.map((inf) => (
                  <label key={inf.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded text-sm">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>{inf.name}</span>
                    <span className="text-xs text-gray-400">{inf.platform}</span>
                    {inf.email && <span className="text-xs text-gray-400">{inf.email}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="text-sm text-gray-500 p-3 bg-amber-50 rounded-lg">
              ⚠️ 发送限制：单账号每日 ≤50 封，每封间隔 ≥2 分钟，避免风控
            </div>

            <button className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
              开始批量发送
            </button>
          </div>
        </div>

        {/* Right: Rules */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="font-semibold text-lg mb-4">发送规则</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              按平台归属分组发送
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              自动填充变量：昵称、产品、佣金、联系方式
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              单账号每日发送上限 ≤ 50 封
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              每封间隔 ≥ 2 分钟
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              分时段发送，避开风控高峰
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-500">•</span>
              多账号轮询分摊发送量
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
