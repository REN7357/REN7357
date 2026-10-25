import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFulfillmentOrders, markReadyForPickup, createFulfillment } from "@/lib/shopify/client";
import { verifyErpRequest } from "@/lib/erp/client";

// ERP → Shopify 履约回传
// body: { requestId, shopifyOrderId, action: "ready_for_pickup" | "picked_up" | "shipped", tracking? }
export async function POST(req: NextRequest) {
  if (!verifyErpRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, shopifyOrderId, action, tracking } = await req.json();
  if (!requestId || !shopifyOrderId || !["ready_for_pickup", "picked_up", "shipped"].includes(action)) {
    return NextResponse.json({ error: "requestId, shopifyOrderId and valid action required" }, { status: 400 });
  }

  const externalId = `erp-ful-${requestId}`;
  const existing = await prisma.syncEvent.findUnique({ where: { externalId } });
  if (existing?.status === "success") return NextResponse.json({ ok: true, duplicate: true });

  const event = existing
    ?? (await prisma.syncEvent.create({
      data: { source: "erp", externalId, topic: `fulfillment/${action}`, payload: JSON.stringify({ shopifyOrderId, tracking }) },
    }));

  try {
    const open = (await getFulfillmentOrders(shopifyOrderId)).filter((fo) =>
      ["OPEN", "IN_PROGRESS"].includes(fo.status)
    );
    if (!open.length) throw new Error("No open fulfillment orders");

    const ids = open.map((fo) => fo.id);
    const errors =
      action === "ready_for_pickup"
        ? await markReadyForPickup(ids)
        : await createFulfillment(ids, action === "shipped" ? tracking : undefined);
    if (errors.length) throw new Error(errors.join("; "));

    await prisma.syncEvent.update({
      where: { id: event.id },
      data: { status: "success", attempts: { increment: 1 }, error: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await prisma.syncEvent.update({
      where: { id: event.id },
      data: { status: "failed", attempts: { increment: 1 }, error: String(e?.message ?? e) },
    });
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
