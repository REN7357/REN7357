import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inventoryItemsBySku, locationMap, setAvailable } from "@/lib/shopify/client";
import { verifyErpRequest } from "@/lib/erp/client";

// ERP → Shopify 库存推送
// body: { requestId, items: [{ sku, warehouseCode, available }] }
export async function POST(req: NextRequest) {
  if (!verifyErpRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, items } = await req.json();
  if (!requestId || !Array.isArray(items)) {
    return NextResponse.json({ error: "requestId and items required" }, { status: 400 });
  }

  const existing = await prisma.syncEvent.findUnique({ where: { externalId: `erp-inv-${requestId}` } });
  if (existing?.status === "success") return NextResponse.json({ ok: true, duplicate: true });

  const event = existing
    ?? (await prisma.syncEvent.create({
      data: { source: "erp", externalId: `erp-inv-${requestId}`, topic: "inventory", payload: JSON.stringify(items) },
    }));

  try {
    const locations = locationMap();
    const itemIds = await inventoryItemsBySku([...new Set<string>(items.map((i: any) => i.sku))]);

    const skipped: { sku: string; reason: string }[] = [];
    const quantities: { inventoryItemId: string; locationId: string; quantity: number }[] = [];
    for (const i of items) {
      const inventoryItemId = itemIds.get(i.sku);
      const locationId = locations[i.warehouseCode];
      if (!inventoryItemId) skipped.push({ sku: i.sku, reason: "SKU not in Shopify" });
      else if (!locationId) skipped.push({ sku: i.sku, reason: `Unknown warehouse ${i.warehouseCode}` });
      else quantities.push({ inventoryItemId, locationId, quantity: Math.max(0, Math.floor(i.available)) });
    }

    const errors = quantities.length
      ? await setAvailable(quantities, `erp-inv-${requestId}`, `erp://inventory/${requestId}`)
      : [];

    await prisma.syncEvent.update({
      where: { id: event.id },
      data: {
        status: errors.length ? "failed" : "success",
        attempts: { increment: 1 },
        error: errors.length ? errors.join("; ") : null,
      },
    });
    return NextResponse.json({ ok: !errors.length, updated: quantities.length, skipped, errors });
  } catch (e: any) {
    await prisma.syncEvent.update({
      where: { id: event.id },
      data: { status: "failed", attempts: { increment: 1 }, error: String(e?.message ?? e) },
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
