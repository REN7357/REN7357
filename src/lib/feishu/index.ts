/**
 * 飞书集成模块
 * 功能：群消息通知 & 多维表同步
 */

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

interface FeishuConfig {
  appId: string;
  appSecret: string;
}

let config: FeishuConfig | null = null;
let tenantToken: string | null = null;
let tokenExpiresAt = 0;

export function initFeishu(cfg: FeishuConfig) {
  config = cfg;
}

async function getTenantToken(): Promise<string> {
  if (tenantToken && Date.now() < tokenExpiresAt - 60_000) {
    return tenantToken;
  }
  if (!config) throw new Error("Feishu not configured");

  const res = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
  });
  const data = await res.json();
  tenantToken = data.tenant_access_token;
  tokenExpiresAt = Date.now() + data.expire * 1000;
  return tenantToken!;
}

/** 发送飞书群消息 */
export async function sendMessage(chatId: string, content: string) {
  const token = await getTenantToken();
  const res = await fetch(`${FEISHU_BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text: content }),
    }),
  });
  return res.json();
}

/** 往飞书多维表追加记录 */
export async function appendBitableRecord(
  appToken: string,
  tableId: string,
  fields: Record<string, any>
) {
  const token = await getTenantToken();
  const res = await fetch(
    `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
  return res.json();
}

/** 从飞书多维表查询已合作达人（用于去重） */
export async function getCooperatedInfluencers(
  appToken: string,
  tableId: string
): Promise<{ name: string; platform?: string }[]> {
  const token = await getTenantToken();
  const res = await fetch(
    `${FEISHU_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  return (data.data?.items || []).map((r: any) => ({
    name: r.fields["达人昵称"] || r.fields["name"] || "",
    platform: r.fields["平台"] || r.fields["platform"] || "",
  }));
}
