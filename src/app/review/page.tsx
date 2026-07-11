import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ReviewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const pending = await prisma.influencer.findMany({
    where: { status: "passed", reviewStatus: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const reviewed = await prisma.influencer.findMany({
    where: { reviewStatus: { not: "pending" } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">人工复审</h1>
        <span className="text-sm text-gray-500">待复审: {pending.length} 人</span>
      </div>

      {pending.length === 0 && reviewed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>暂无待复审达人</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pending Review */}
          <div>
            <h2 className="font-semibold text-lg mb-4 text-yellow-700">待复审</h2>
            {pending.map((inf) => (
              <div key={inf.id} className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{inf.name}</h3>
                    <p className="text-sm text-gray-500">{inf.platform} | {inf.followers.toLocaleString()} 粉丝</p>
                  </div>
                </div>
                {inf.aiSummary && <p className="text-sm text-gray-600 mt-2 line-clamp-2">AI: {inf.aiSummary}</p>}
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700">优质</button>
                  <button className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700">可合作</button>
                  <button className="flex-1 bg-red-600 text-white text-sm py-2 rounded-lg hover:bg-red-700">不合格</button>
                </div>
              </div>
            ))}
          </div>

          {/* Reviewed History */}
          <div>
            <h2 className="font-semibold text-lg mb-4 text-gray-600">复审历史</h2>
            {reviewed.map((inf) => (
              <div key={inf.id} className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{inf.name}</h3>
                    <p className="text-sm text-gray-500">{inf.platform}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    inf.reviewStatus === "qualified" ? "bg-green-100 text-green-800" :
                    inf.reviewStatus === " cooperable" ? "bg-blue-100 text-blue-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {inf.reviewStatus}
                  </span>
                </div>
                {inf.reviewNote && <p className="text-sm text-gray-500 mt-1">备注: {inf.reviewNote}</p>}
                {inf.reviewedAt && <p className="text-xs text-gray-400 mt-1">{new Date(inf.reviewedAt).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
