import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const reports = await prisma.iterationReport.findMany({ orderBy: { weekStart: "desc" } });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 迭代报告</h1>
        <span className="text-sm text-gray-500">每周一全量迭代</span>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">暂无迭代报告</p>
          <p className="text-sm">当有足够数据后，AI 将自动生成每周迭代报告</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div key={r.id} className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold">
                    {new Date(r.weekStart).toLocaleDateString()} - {new Date(r.weekEnd).toLocaleDateString()}
                  </h3>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>新增: {r.newInfluencers}</span>
                  <span>通过: {r.passedCount}</span>
                  <span>回复: {r.repliedCount}</span>
                  <span>意向: {r.interestedCount}</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700 mb-1">AI 总结</p>
                  <p className="text-gray-600">{r.summary}</p>
                </div>
                {r.topTags && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">高频标签</p>
                    <p className="text-gray-600">{r.topTags}</p>
                  </div>
                )}
              </div>

              {(r.updatedSearchRules || r.updatedTagFilters || r.updatedTemplates) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="font-medium text-sm text-gray-700 mb-2">更新内容</p>
                  <div className="space-y-1 text-sm text-gray-600">
                    {r.updatedSearchRules && <p>🔍 搜索规则: {r.updatedSearchRules}</p>}
                    {r.updatedTagFilters && <p>🏷️ 标签过滤: {r.updatedTagFilters}</p>}
                    {r.updatedTemplates && <p>📧 邮件模板: {r.updatedTemplates}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
