/**
 * TikTok 公开视频抓取（原生 fetch，无需第三方包）
 * - 视频详情：解析网页内嵌的 __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON
 * - 评论：调用网页端 comment/list 接口（需带上详情页下发的 cookie）
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface TikTokVideo {
  url: string;
  videoId: string;
  author: string;
  authorFollowers: number;
  description: string;
  hashtags: string[];
  mentions: string[];
  music: string | null;
  duration: number;
  postedAt: Date | null;
  stats: { views: number; likes: number; comments: number; shares: number; saves: number };
}

export interface TikTokComment {
  cid: string;
  text: string;
  likes: number;
  replyCount: number;
  replies?: { text: string; likes: number }[];
}

export function parseVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

async function resolveUrl(url: string): Promise<string> {
  // 短链 vm.tiktok.com / vt.tiktok.com 需要跟随跳转拿到完整地址
  if (parseVideoId(url)) return url;
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  return res.url;
}

function collectCookies(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

export async function fetchTikTokVideo(
  inputUrl: string
): Promise<{ video: TikTokVideo; cookies: string }> {
  const url = await resolveUrl(inputUrl.trim());
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("无法识别 TikTok 视频链接");

  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`TikTok 页面请求失败: HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) throw new Error("TikTok 页面结构变化或被风控，未找到视频数据");

  const detail = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const item = detail?.itemInfo?.itemStruct;
  if (!item) throw new Error(`视频不可用（statusCode ${detail?.statusCode ?? "unknown"}）`);

  const extras: any[] = item.textExtra || [];
  const stats = item.statsV2 || item.stats || {};
  const num = (v: any) => Number(v) || 0;

  return {
    cookies: collectCookies(res),
    video: {
      url,
      videoId,
      author: item.author?.uniqueId || "",
      authorFollowers: num(item.authorStats?.followerCount),
      description: item.desc || "",
      hashtags: extras.filter((x) => x.hashtagName).map((x) => x.hashtagName),
      mentions: extras.filter((x) => x.userUniqueId).map((x) => x.userUniqueId),
      music: item.music ? `${item.music.title || ""} - ${item.music.authorName || ""}` : null,
      duration: num(item.video?.duration),
      postedAt: item.createTime ? new Date(num(item.createTime) * 1000) : null,
      stats: {
        views: num(stats.playCount),
        likes: num(stats.diggCount),
        comments: num(stats.commentCount),
        shares: num(stats.shareCount),
        saves: num(stats.collectCount),
      },
    },
  };
}

async function getJSON(url: string, cookies: string, referer: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: cookies, Referer: referer },
  });
  if (!res.ok) throw new Error(`评论接口 HTTP ${res.status}`);
  const text = await res.text();
  if (!text) throw new Error("评论接口返回空（可能被风控）");
  return JSON.parse(text);
}

/**
 * 抓取评论（按页 50 条），并为点赞最高的几条评论抓取回复
 */
export async function fetchTikTokComments(
  video: TikTokVideo,
  cookies: string,
  options?: { max?: number; repliesFor?: number }
): Promise<TikTokComment[]> {
  const max = options?.max ?? 300;
  const repliesFor = options?.repliesFor ?? 3;
  const comments: TikTokComment[] = [];

  for (let cursor = 0; comments.length < max; ) {
    const data = await getJSON(
      `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${video.videoId}&count=50&cursor=${cursor}`,
      cookies,
      video.url
    );
    for (const c of data.comments || []) {
      comments.push({
        cid: c.cid,
        text: c.text || "",
        likes: Number(c.digg_count) || 0,
        replyCount: Number(c.reply_comment_total) || 0,
      });
    }
    if (!data.has_more || !data.comments?.length) break;
    cursor = Number(data.cursor) || cursor + 50;
  }

  comments.sort((a, b) => b.likes - a.likes);

  for (const c of comments.slice(0, repliesFor).filter((c) => c.replyCount > 0)) {
    try {
      const data = await getJSON(
        `https://www.tiktok.com/api/comment/list/reply/?aid=1988&item_id=${video.videoId}&comment_id=${c.cid}&count=30&cursor=0`,
        cookies,
        video.url
      );
      c.replies = (data.comments || [])
        .map((r: any) => ({ text: r.text || "", likes: Number(r.digg_count) || 0 }))
        .sort((a: any, b: any) => b.likes - a.likes)
        .slice(0, 10);
    } catch {
      // 回复抓取失败不影响主流程
    }
  }

  return comments.slice(0, max);
}
