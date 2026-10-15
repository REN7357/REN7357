"use client";
import { useState } from "react";

const gradeColors: Record<string, string> = {
  S: "bg-red-100 text-red-700",
  A: "bg-amber-100 text-amber-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-gray-100 text-gray-600",
};

const parse = (s: string | null, fallback: any) => {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-gray-400">-</p>;
  return (
    <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

function Detail({ a }: { a: any }) {
  const metrics = parse(a.metrics, {});
  const stats = parse(a.commentStats, { total: 0, categories: {} });
  const top = parse(a.topComments, []);
  const r = parse(a.result, null);
  const hashtags: string[] = parse(a.hashtags, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <a href={a.url} target="_blank" className="font-semibold text-indigo-600 hover:underline">
              @{a.author}
            </a>
            <span className="text-sm text-gray-500 ml-2">
              {fmt(a.authorFollowers)} 粉丝 · {a.duration}s · {a.music || "-"}
            </span>
            <p className="text-sm text-gray-700 mt-1">{a.description}</p>
            <p className="text-xs text-gray-400 mt-1">
              {hashtags.map((h) => `#${h}`).join(" ")}
              {a.influencer && <> · 已关联达人：{a.influencer.name}</>}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[metrics.grade] || ""}`}>
            {metrics.grade}
          </span>
        </div>
        {a.errorMsg && <p className="text-xs text-amber-600 mt-2">⚠ {a.errorMsg}</p>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          ["播放", fmt(a.views)],
          ["互动率", `${metrics.engagementRate}%`],
          ["点赞率", `${metrics.likeRate}%`],
          ["收藏率", `${metrics.saveRate}%`],
          ["分享率", `${metrics.shareRate}%`],
          ["评论率", `${metrics.commentRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white p-3 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500">{k}</p>
            <p className="text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>
      {metrics.drivers?.length > 0 && (
        <p className="text-sm text-gray-600">数据判断：{metrics.drivers.join("；")}</p>
      )}

      {r && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
            <p className="text-xs text-indigo-500 mb-1">本质</p>
            <p className="font-semibold text-indigo-900">{r.summary}</p>
            <p className="text-sm text-indigo-800 mt-2">钩子：{r.hook}</p>
          </div>

          <Section title="视频结构">
            <table className="w-full text-sm">
              <thead className="text-gray-500">
                <tr><th className="text-left py-1 w-32">段落</th><th className="text-left py-1">内容</th><th className="text-left py-1">作用</th></tr>
              </thead>
              <tbody>
                {(r.structure || []).map((s: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="py-2 font-medium">{s.segment}</td>
                    <td className="py-2 pr-3">{s.content}</td>
                    <td className="py-2 text-gray-600">{s.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div className="grid md:grid-cols-2 gap-4">
            <Section title="🔥 爆款原因"><List items={r.viralDrivers} /></Section>
            <Section title="🎯 用户真正在意"><List items={r.audienceNeeds} /></Section>
          </div>

          <Section title="评论洞察">
            <div className="space-y-2">
              {(r.commentInsights || []).map((c: any, i: number) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{c.theme}</span>
                  <span className="text-gray-400 ml-2">{c.share}</span>
                  <p className="text-gray-500 italic">“{c.evidence}”</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-4">
            <Section title="💸 转化漏点"><List items={r.conversionGaps} /></Section>
            <Section title="⚠️ 风险"><List items={r.risks} /></Section>
          </div>

          <Section title="✅ 行动建议"><List items={r.actions} /></Section>

          {r.influencerFit && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex gap-4 items-center">
              <div className="text-3xl font-bold text-indigo-600">{r.influencerFit.score}</div>
              <div className="text-sm text-gray-700">
                <p className="font-semibold">达人合作价值</p>
                <p>{r.influencerFit.reason}</p>
              </div>
            </div>
          )}
        </>
      )}

      <Section title={`评论分类（抓取 ${stats.total} 条${stats.reported ? ` / 公布 ${stats.reported} 条` : ""}）`}>
        {stats.reported > 0 && (
          <p className="text-xs text-gray-400 -mt-2 mb-3">
            一级评论 {stats.topLevel} + 回复 {stats.replies}；与公布数的差额为已删除、被折叠或被过滤的评论，接口不可见
          </p>
        )}
        <div className="space-y-3">
          {Object.entries(stats.categories as Record<string, any>).map(([name, c]) => (
            <div key={name}>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-28 font-medium">{name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${stats.total ? (c.count / stats.total) * 100 : 0}%` }} />
                </div>
                <span className="w-10 text-right text-gray-500">{c.count}</span>
              </div>
              {c.samples.length > 0 && (
                <p className="text-xs text-gray-500 ml-28 pl-2 mt-1 truncate">{c.samples.slice(0, 3).join(" ｜ ")}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="高赞评论">
        <div className="space-y-2 text-sm">
          {top.slice(0, 10).map((c: any) => (
            <div key={c.cid} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
              <p><span className="text-gray-400 mr-2">👍 {fmt(c.likes)}</span>{c.text}</p>
              {c.replies?.slice(0, 4).map((rp: any, i: number) => (
                <p key={i} className="text-xs text-gray-500 ml-6 mt-1">↳ {rp.text} <span className="text-gray-400">({rp.likes})</span></p>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function ContentClientPage({ analyses, influencers }: any) {
  const [list, setList] = useState<any[]>(analyses);
  const [selectedId, setSelectedId] = useState<string | null>(analyses[0]?.id ?? null);
  const [url, setUrl] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = list.find((a) => a.id === selectedId);

  async function analyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), influencerId: influencerId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析失败");
      setList([data, ...list]);
      setSelectedId(data.id);
      setUrl("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">内容分析</h1>
        <span className="text-sm text-gray-500">爆款视频拆解：结构 + 评论洞察</span>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
        <div className="flex gap-3">
          <input type="text" placeholder="粘贴 TikTok 视频链接，如 https://www.tiktok.com/@user/video/123..."
            value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
          <select value={influencerId} onChange={(e) => setInfluencerId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm max-w-[180px]">
            <option value="">自动关联达人</option>
            {influencers.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button onClick={analyze} disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "分析中（约 30 秒）..." : "开始拆解"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">历史记录</h2>
          {list.length === 0 && <p className="text-sm text-gray-400">暂无分析记录</p>}
          {list.map((a) => {
            const m = parse(a.metrics, {});
            return (
              <button key={a.id} onClick={() => setSelectedId(a.id)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition ${
                  a.id === selectedId ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}>
                <div className="flex justify-between">
                  <span className="font-medium truncate">@{a.author}</span>
                  <span className={`px-1.5 rounded text-xs font-bold ${gradeColors[m.grade] || ""}`}>{m.grade}</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-1">{a.description}</p>
                <p className="text-xs text-gray-400 mt-1">{fmt(a.views)} 播放 · 互动 {m.engagementRate}%</p>
              </button>
            );
          })}
        </div>
        <div>{selected ? <Detail a={selected} /> : <p className="text-gray-400 text-center py-20">输入链接开始拆解</p>}</div>
      </div>
    </div>
  );
}
