import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook, getFulfillmentOrders } from "@/lib/shopify/client";
import { toErpOrder, pushOrder, cancelOrder } from "@/lib/erp/client";

// Shopify webhook 入口：订单 → ERP
// 返回非 2xx 时 Shopify 会在 4 小时内重试 8 次，按 webhook id 去重
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") || "";
  const webhookId = req.headers.get("x-shopify-webhook-id") || "";
  if (!webhookId) return NextResponse.json({ error: "Missing webhook id" }, { status: 400 });

  const existing = await prisma.syncEvent.findUnique({ where: { externalId: webhookId } });
  if (existing?.status === "success") return NextResponse.json({ ok: true, duplicate: true });

  const event = existing
    ? await prisma.syncEvent.update({ where: { id: existing.id }, data: { attempts: { increment: 1 } } })
    : await prisma.syncEvent.create({
        data: { source: "shopify", externalId: webhookId, topic, attempts: 1, payload: raw },
      });

  try {
    const payload = JSON.parse(raw);
    switch (topic) {
      case "orders/create": {
        const fulfillmentOrders = await getFulfillmentOrders(payload.admin_graphql_api_id);
        await pushOrder(toErpOrder(payload, fulfillmentOrders));
        break;
      }
      case "orders/cancelled":
        await cancelOrder(payload.admin_graphql_api_id, payload.cancel_reason ?? null);
        break;
      default:
        // 未订阅的主题直接确认，避免 Shopify 反复重试
        break;
    }
    await prisma.syncEvent.update({ where: { id: event.id }, data: { status: "success", error: null } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await prisma.syncEvent.update({ where: { id: event.id }, data: { status: "failed", error: String(e?.message ?? e) } });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
