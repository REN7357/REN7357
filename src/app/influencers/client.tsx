"use client";
import { useState } from "react";

const statusColors: Record<string, string> = {
  raw: "bg-gray-100 text-gray-800",
  deduped: "bg-yellow-100 text-yellow-800",
  filtered: "bg-red-100 text-red-800",
  passed: "bg-green-100 text-green-800",
  contacted: "bg-blue-100 text-blue-800",
  replied: "bg-purple-100 text-purple-800",
  interested: "bg-amber-100 text-amber-800",
  cooperating: "bg-emerald-100 text-emerald-800",
  ended: "bg-slate-100 text-slate-800",
};

export default function InfluencersClientPage({ influencers, channels, stats }: any) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = influencers.filter((i: any) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">达人管理</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + 导入达人
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">总计</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">待处理</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.raw}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">已通过</p>
          <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">已过滤</p>
          <p className="text-2xl font-bold text-red-600">{stats.filtered}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="搜索达人昵称..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">全部状态</option>
          {Object.keys(statusColors).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">昵称</th>
              <th className="text-left px-4 py-3">平台</th>
              <th className="text-left px-4 py-3">粉丝数</th>
              <th className="text-left px-4 py-3">30天销量</th>
              <th className="text-left px-4 py-3">标签</th>
              <th className="text-left px-4 py-3">状态</th>
              <th className="text-left px-4 py-3">来源</th>
              <th className="text-left px-4 py-3">邮箱</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inf: any) => (
              <tr key={inf.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{inf.name}</td>
                <td className="px-4 py-3">{inf.platform}</td>
                <td className="px-4 py-3">{inf.followers.toLocaleString()}</td>
                <td className="px-4 py-3">{inf.sales30d}</td>
                <td className="px-4 py-3 max-w-[200px] truncate">{inf.tags}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[inf.status] || "bg-gray-100"}`}>
                    {inf.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{inf.sourceChannel || "-"}</td>
                <td className="px-4 py-3 text-gray-500">{inf.email || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
