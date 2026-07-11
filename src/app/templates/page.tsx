import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } });

  const typeLabels: Record<string, string> = {
    benefit: "利益型",
    value: "价值型",
    test: "测试",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">邮件模板</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ 新建模板</button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">暂无邮件模板</p>
          <p className="text-sm">AI 话术优化功能会在这里自动生成模板</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                    {typeLabels[t.type] || t.type}
                  </span>
                </div>
                <span className="text-xs text-gray-400">v{t.version}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                <span className="font-medium">主题:</span> {t.subject}
              </p>
              <div className="text-xs text-gray-500 flex gap-4">
                <span>打开率: {t.openRate}%</span>
                <span>回复率: {t.replyRate}%</span>
                <span>意向率: {t.interestRate}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
