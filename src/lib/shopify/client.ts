/**
 * Shopify Admin GraphQL 客户端
 * 功能：库存写入、履约订单查询、自提备货/发货回传
 */

import { createHmac, timingSafeEqual } from "crypto";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * 旧版自定义应用：直接用 SHOPIFY_ADMIN_TOKEN（shpat_，不过期）
 * Dev Dashboard 应用（2026 起新建）：client credentials 换取 24 小时 token，自动续期
 */
async function getAccessToken(shop: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (cachedToken && Date.now() < tokenExpiresAt - 300_000) return cachedToken;

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) throw new Error("Shopify not configured");

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Shopify token HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 86_400) * 1000;
  return cachedToken!;
}

export async function shopifyGql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const shop = process.env.SHOPIFY_SHOP;
  if (!shop) throw new Error("Shopify not configured");
  const token = await getAccessToken(shop);

  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(`Shopify GraphQL: ${JSON.stringify(data.errors)}`);
  return data.data as T;
}

/** 校验 webhook 签名：HMAC-SHA256(原始 body, 应用密钥) 的 base64 */
export function verifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const received = Buffer.from(hmacHeader, "base64");
  return received.length === digest.length && timingSafeEqual(received, digest);
}

/** ERP 仓库编码 → Shopify Location GID */
export function locationMap(): Record<string, string> {
  return JSON.parse(process.env.SHOPIFY_LOCATION_MAP || "{}");
}

export function warehouseForLocation(locationGid: string): string | undefined {
  return Object.entries(locationMap()).find(([, gid]) => gid === locationGid)?.[0];
}

export interface FulfillmentOrderInfo {
  id: string;
  status: string;
  methodType: string; // SHIPPING, PICK_UP, LOCAL
  locationId: string;
}

export async function getFulfillmentOrders(orderGid: string): Promise<FulfillmentOrderInfo[]> {
  const data = await shopifyGql(
    `query($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 10) {
          nodes { id status deliveryMethod { methodType } assignedLocation { location { id } } }
        }
      }
    }`,
    { id: orderGid }
  );
  return (data.order?.fulfillmentOrders.nodes ?? []).map((fo: any) => ({
    id: fo.id,
    status: fo.status,
    methodType: fo.deliveryMethod?.methodType ?? "SHIPPING",
    locationId: fo.assignedLocation?.location?.id ?? "",
  }));
}

/** SKU → InventoryItem GID，每次查询 50 个 SKU */
export async function inventoryItemsBySku(skus: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let i = 0; i < skus.length; i += 50) {
    const batch = skus.slice(i, i + 50);
    const query = batch.map((s) => `sku:"${s.replace(/"/g, '\\"')}"`).join(" OR ");
    const data = await shopifyGql(
      `query($q: String!) {
        productVariants(first: 250, query: $q) { nodes { sku inventoryItem { id } } }
      }`,
      { q: query }
    );
    for (const v of data.productVariants.nodes) {
      if (v.sku) result.set(v.sku, v.inventoryItem.id);
    }
  }
  return result;
}

/** 以 ERP 为准覆盖门店可售库存（不做比较，ERP 是库存主数据） */
export async function setAvailable(
  quantities: { inventoryItemId: string; locationId: string; quantity: number }[],
  idempotencyKey: string,
  referenceUri: string
) {
  const errors: string[] = [];
  for (let i = 0; i < quantities.length; i += 250) {
    const chunk = quantities.slice(i, i + 250);
    const data = await shopifyGql(
      `mutation($input: InventorySetQuantitiesInput!, $key: String!) {
        inventorySetQuantities(input: $input) @idempotent(key: $key) {
          userErrors { field message }
        }
      }`,
      {
        key: `${idempotencyKey}-${i}`,
        input: {
          name: "available",
          reason: "correction",
          referenceDocumentUri: referenceUri,
          quantities: chunk.map((q) => ({ ...q, changeFromQuantity: null })),
        },
      }
    );
    for (const e of data.inventorySetQuantities.userErrors) errors.push(e.message);
  }
  return errors;
}

/** 自提单：标记备货完成，Shopify 通知客户可取货 */
export async function markReadyForPickup(fulfillmentOrderIds: string[]) {
  const data = await shopifyGql(
    `mutation($input: FulfillmentOrderLineItemsPreparedForPickupInput!) {
      fulfillmentOrderLineItemsPreparedForPickup(input: $input) { userErrors { field message } }
    }`,
    { input: { lineItemsByFulfillmentOrder: fulfillmentOrderIds.map((id) => ({ fulfillmentOrderId: id })) } }
  );
  return data.fulfillmentOrderLineItemsPreparedForPickup.userErrors.map((e: any) => e.message) as string[];
}

/** 发货或自提完成：创建 fulfillment（配送单可带物流单号） */
export async function createFulfillment(
  fulfillmentOrderIds: string[],
  tracking?: { company?: string; number?: string; url?: string }
) {
  const data = await shopifyGql(
    `mutation($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) { userErrors { field message } }
    }`,
    {
      fulfillment: {
        lineItemsByFulfillmentOrder: fulfillmentOrderIds.map((id) => ({ fulfillmentOrderId: id })),
        notifyCustomer: true,
        ...(tracking?.number ? { trackingInfo: tracking } : {}),
      },
    }
  );
  return data.fulfillmentCreate.userErrors.map((e: any) => e.message) as string[];
}
