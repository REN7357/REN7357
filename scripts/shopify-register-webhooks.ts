/**
 * 一次性注册 Shopify webhook（订单创建/取消 → 本系统 → ERP）
 * 用法：WEBHOOK_URL=https://<域名>/api/shopify/webhooks npx tsx scripts/shopify-register-webhooks.ts
 */
import { shopifyGql } from "../src/lib/shopify/client";

const TOPICS = ["ORDERS_CREATE", "ORDERS_CANCELLED"];

async function main() {
  const uri = process.env.WEBHOOK_URL;
  if (!uri) throw new Error("WEBHOOK_URL required");

  for (const topic of TOPICS) {
    const data = await shopifyGql(
      `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      { topic, sub: { uri, format: "JSON" } }
    );
    const r = data.webhookSubscriptionCreate;
    console.log(topic, r.userErrors.length ? r.userErrors : r.webhookSubscription.id);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
