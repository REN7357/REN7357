# TEDHAIR.COM（Shopify）↔ 自研 ERP 对接规格

**原则：ERP 是商品、库存、客户账期的主数据；Shopify 是下单入口。** 本系统（本仓库，部署在 Vercel）做中间层：Shopify 侧已实现，ERP 侧按下文"ERP 需实现的接口"开发即可。

## 数据流

| # | 方向 | 触发 | 内容 | 状态 |
|---|------|------|------|------|
| 1 | Shopify → ERP | 下单（webhook `orders/create`） | 销售单：客户/公司、SKU、单价、账期、自提或配送、履约门店 | 已实现 |
| 2 | Shopify → ERP | 取消（webhook `orders/cancelled`） | 取消销售单 | 已实现 |
| 3 | ERP → Shopify | ERP 库存变动时推送 + 每晚全量 | 各门店可售库存 | 已实现 |
| 4 | ERP → Shopify | 备货完成 / 客户取走 / 发货 | 自提就绪通知、履约完成、物流单号 | 已实现 |
| 5 | ERP → Shopify | 月度判级 | 客户等级 → Shopify 分级价目录 | 第二期（待分级价方案定） |
| 6 | Shopify → ERP | 账期客户付款 | 回款核销 | 第二期 |

## 本系统提供的接口（ERP 调用）

鉴权：`Authorization: Bearer <ERP_INBOUND_TOKEN>`。`requestId` 由 ERP 生成且唯一；同一 `requestId` 重发不会重复执行，失败可放心重试。

### POST /api/erp/inventory — 推送库存

```json
{ "requestId": "inv-20261025-0001",
  "items": [ { "sku": "BW-22", "warehouseCode": "NY01", "available": 12 } ] }
```

- `available` = 可售数（ERP 已扣除锁定/在途），直接覆盖 Shopify，不做加减。
- `warehouseCode` 需在环境变量 `SHOPIFY_LOCATION_MAP` 中映射到 Shopify 门店。
- 返回 `skipped` 列出 Shopify 中不存在的 SKU 或未映射仓库，ERP 侧应告警。

### POST /api/erp/fulfillment — 履约回传

```json
{ "requestId": "ful-1001-ready", "shopifyOrderId": "gid://shopify/Order/1",
  "action": "ready_for_pickup",
  "tracking": { "company": "UPS", "number": "1Z...", "url": "https://..." } }
```

| action | 含义 | Shopify 效果 |
|--------|------|--------------|
| `ready_for_pickup` | 门店备货完成 | 自动通知客户可取货（1 小时取货 KPI 的计时终点） |
| `picked_up` | 客户已取走 | 订单标记已履约 |
| `shipped` | 已发货 | 订单标记已履约，带物流单号通知客户 |

## ERP 需实现的接口（本系统调用）

鉴权：本系统请求头带 `Authorization: Bearer <ERP_API_KEY>`。基础地址 `ERP_BASE_URL`。

### POST {ERP_BASE_URL}/orders — 接收销售单

```json
{ "shopifyOrderId": "gid://shopify/Order/1", "orderNo": "#1001", "createdAt": "...",
  "currency": "USD", "subtotal": 100, "tax": 8, "total": 108,
  "financialStatus": "pending", "paymentTermsName": "Net 15",
  "customer": { "shopifyCustomerId": "gid://shopify/Customer/3", "email": "...", "name": "...", "phone": null },
  "company": { "shopifyCompanyId": "gid://shopify/Company/7", "shopifyLocationId": "gid://shopify/CompanyLocation/8" },
  "deliveryMethod": "PICK_UP", "warehouseCode": "NY01", "shippingAddress": null,
  "lines": [ { "sku": "BW-22", "title": "Body Wave 22", "quantity": 2, "unitPrice": 50 } ],
  "note": null }
```

- **必须按 `shopifyOrderId` 幂等**：已存在返回 `409` 或 `200`，不得重复建单（Shopify 会重试推送）。
- `company` 非空 = B2B 订单；`shopifyCompanyId` 作为 ERP 客户的外部 ID，首次出现时自动建档（对应"客户建档率 100%"）。
- `paymentTermsName` 非空 = 账期单，ERP 记应收。
- `deliveryMethod=PICK_UP` 时按 `warehouseCode` 生成门店拣货单。
- 返回 2xx 即视为成功；5xx 会触发 Shopify 在 4 小时内重试 8 次；仍失败需按 SyncEvent 记录人工补推。

### POST {ERP_BASE_URL}/orders/cancel

```json
{ "shopifyOrderId": "gid://shopify/Order/1", "reason": "customer" }
```

释放锁定库存，然后通过 `/api/erp/inventory` 回推最新可售数。

## 上线步骤

**CEO / 店铺管理员（约 15 分钟）**
1. Shopify 后台 → 设置 → 应用和销售渠道 → 开发应用，进入 Dev Dashboard 新建应用（2026 年起新应用只能在此创建）。
2. 勾选 Admin API 权限：`read_orders`、`read_products`、`read_inventory`、`write_inventory`、`read_merchant_managed_fulfillment_orders`、`write_merchant_managed_fulfillment_orders`、`read_customers`、`read_companies`。
3. 安装到 TEDHAIR 店铺，把 Client ID 和 Client Secret 交给技术负责人，**直接填入 Vercel 环境变量，不要发在聊天或邮件里**。
4. 在 设置 → 地点 中记下纽约两店的 Location ID，与 ERP 仓库编码配对。

**技术负责人**
1. Vercel 环境变量按 `.env.example` 填写（`SHOPIFY_*`、`ERP_*`）。
2. **数据库从 SQLite 换为 Postgres**（如 Vercel Postgres / Neon）：Vercel 上 SQLite 文件不持久，去重记录会丢失。改 `prisma/schema.prisma` 的 `provider` 与 `DATABASE_URL` 后执行 `npx prisma db push`。
3. 注册 webhook：`WEBHOOK_URL=https://<域名>/api/shopify/webhooks npx tsx scripts/shopify-register-webhooks.ts`
4. ERP 开发 `/orders`、`/orders/cancel` 两个接口，并在库存变动处调用 `/api/erp/inventory`、在拣货/取货/发货节点调用 `/api/erp/fulfillment`。

**验收（纽约打样第 1 周）**
- [ ] 测试单：线上 B2B 下单 → ERP 1 分钟内出现销售单，客户自动建档
- [ ] ERP 改库存 → Shopify 门店库存 1 分钟内一致
- [ ] 门店点"备货完成" → 客户收到可取货通知
- [ ] 取消订单 → ERP 释放库存
- [ ] `SyncEvent` 表无持续 `failed` 记录（失败原因见 `error` 字段）
