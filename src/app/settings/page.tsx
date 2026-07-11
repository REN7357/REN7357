import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [channels, tagRules, syncLogs] = await Promise.all([
    prisma.channel.findMany(),
    prisma.tagRule.findMany(),
    prisma.feishuSyncLog.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">系统设置</h1>

      {/* Channels */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <h2 className="font-semibold text-lg mb-4">渠道管理</h2>
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <span className="font-medium">{ch.label}</span>
                <span className="text-sm text-gray-500 ml-2">({ch.name})</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${ch.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                {ch.isActive ? "启用" : "停用"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Tag Rules */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
        <h2 className="font-semibold text-lg mb-4">标签规则</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-green-700 mb-2">✅ 允许标签</h3>
            <div className="flex flex-wrap gap-2">
              {tagRules.filter((t) => t.category === "allowed").map((t) => (
                <span key={t.id} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-700 mb-2">❌ 拒绝标签</h3>
            <div className="flex flex-wrap gap-2">
              {tagRules.filter((t) => t.category === "rejected").map((t) => (
                <span key={t.id} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm border border-red-200">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feishu Sync */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="font-semibold text-lg mb-4">飞书同步记录</h2>
        {syncLogs.length === 0 ? (
          <p className="text-sm text-gray-400">暂无同步记录</p>
        ) : (
          <div className="space-y-2">
            {syncLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                <div className="flex gap-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    log.direction === "to_feishu" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                  }`}>
                    {log.direction === "to_feishu" ? "→ 飞书" : "← 飞书"}
                  </span>
                  <span>{log.dataType}</span>
                  <span className="text-gray-500">{log.recordCount} 条</span>
                </div>
                <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
