/**
 * 自研 ERP 对接（出站）
 * 接口契约见 docs/shopify-erp-integration.md，由 ERP 侧实现
 */

import { timingSafeEqual } from "crypto";
import { FulfillmentOrderInfo, warehouseForLocation } from "@/lib/shopify/client";

export interface ErpOrder {
  shopifyOrderId: string;
  orderNo: string;
  createdAt: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  financialStatus: string;
  paymentTermsName: string | null; // 如 "Net 15"；非账期为 null
  customer: { shopifyCustomerId: string | null; email: string | null; name: string; phone: string | null };
  company: { shopifyCompanyId: string; shopifyLocationId: string } | null; // B2B 订单才有
  deliveryMethod: string; // PICK_UP, SHIPPING, LOCAL
  warehouseCode: string | null; // 履约门店对应的 ERP 仓库
  shippingAddress: Record<string, any> | null;
  lines: { sku: string; title: string; quantity: number; unitPrice: number }[];
  note: string | null;
}

/** Shopify orders/create webhook 载荷 → ERP 销售单 */
export function toErpOrder(o: any, fulfillmentOrders: FulfillmentOrderInfo[]): ErpOrder {
  const fo = fulfillmentOrders[0];
  const c = o.customer;
  return {
    shopifyOrderId: o.admin_graphql_api_id,
    orderNo: o.name,
    createdAt: o.created_at,
    currency: o.currency,
    subtotal: Number(o.subtotal_price),
    tax: Number(o.total_tax),
    total: Number(o.total_price),
    financialStatus: o.financial_status,
    paymentTermsName: o.payment_terms?.payment_terms_name ?? null,
    customer: {
      shopifyCustomerId: c?.admin_graphql_api_id ?? null,
      email: c?.email ?? o.email ?? null,
      name: [c?.first_name, c?.last_name].filter(Boolean).join(" ") || o.billing_address?.name || "",
      phone: c?.phone ?? o.phone ?? null,
    },
    company: o.company
      ? {
          shopifyCompanyId: `gid://shopify/Company/${o.company.id}`,
          shopifyLocationId: `gid://shopify/CompanyLocation/${o.company.location_id}`,
        }
      : null,
    deliveryMethod: fo?.methodType ?? "SHIPPING",
    warehouseCode: fo ? warehouseForLocation(fo.locationId) ?? null : null,
    shippingAddress: o.shipping_address ?? null,
    lines: (o.line_items ?? []).map((l: any) => ({
      sku: l.sku ?? "",
      title: l.title,
      quantity: l.quantity,
      unitPrice: Number(l.price),
    })),
    note: o.note ?? null,
  };
}

async function erpFetch(path: string, body: unknown) {
  const base = process.env.ERP_BASE_URL;
  const key = process.env.ERP_API_KEY;
  if (!base || !key) throw new Error("ERP not configured");

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  // 409 = ERP 已存在该单，视为成功（幂等）
  if (!res.ok && res.status !== 409) throw new Error(`ERP ${path} HTTP ${res.status}: ${await res.text()}`);
}

export function pushOrder(order: ErpOrder) {
  return erpFetch("/orders", order);
}

export function cancelOrder(shopifyOrderId: string, reason: string | null) {
  return erpFetch("/orders/cancel", { shopifyOrderId, reason });
}

/** 校验 ERP 回调的 Bearer token */
export function verifyErpRequest(authHeader: string | null): boolean {
  const expected = process.env.ERP_INBOUND_TOKEN;
  if (!expected || !authHeader?.startsWith("Bearer ")) return false;
  const a = Buffer.from(authHeader.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
