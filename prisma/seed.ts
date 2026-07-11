import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding BD system...");

  // Admin user
  const password = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@tedhair.com" },
    update: {},
    create: { email: "admin@tedhair.com", name: "Admin", passwordHash: password, role: "admin" },
  });

  // Channels
  const channels = [
    { name: "tiktok", label: "TikTok" },
    { name: "instagram", label: "Instagram" },
    { name: "xiaohongshu", label: "小红书" },
    { name: "youtube", label: "YouTube" },
    { name: "darren_market", label: "达人广场" },
  ];
  for (const ch of channels) {
    await prisma.channel.upsert({ where: { name: ch.name }, update: {}, create: ch });
  }

  // Tag rules
  const allowedTags = ["假发", "发型", "美妆", "时尚", "穿搭", "生活", "职场", "母婴", "配饰"];
  const rejectedTags = ["美食", "宠物", "游戏", "搞笑", "剧情", "科技", "汽车", "体育", "知识", "家居", "手工", "萌宠", "美食教程"];

  for (const tag of allowedTags) {
    await prisma.tagRule.upsert({ where: { name: tag }, update: {}, create: { name: tag, category: "allowed" } });
  }
  for (const tag of rejectedTags) {
    await prisma.tagRule.upsert({ where: { name: tag }, update: {}, create: { name: tag, category: "rejected" } });
  }

  // Email templates
  const templates = [
    {
      name: "利益型 - 高佣金+免费寄样",
      type: "benefit",
      subject: "{{nickname}}，TEDHAIR 邀您合作 | 高佣金+免费寄样",
      body: "Hi {{nickname}},\n\n我是 TEDHAIR 的 BD 团队。看到您在{{platform}}上的内容非常出色，特别想邀请您合作！\n\n我们提供：\n- 高佣金比例（最高 {{commission}}%）\n- 免费寄样体验\n- 投流支持\n- 适合您粉丝群体的优质假发产品\n\n如果您感兴趣，可以联系我：{{contact}}\n\n期待您的回复！\nTEDHAIR BD Team",
    },
    {
      name: "价值型 - 内容匹配+爆款支持",
      type: "value",
      subject: "{{nickname}}，您的风格与 TEDHAIR 很契合",
      body: "Hi {{nickname}},\n\n在{{platform}}上关注您的内容有一段时间了，觉得您的风格非常适合我们的假发产品。\n\nTEDHAIR 是拥有 18 年历史的假发品牌，产品适合各种发质和风格。\n\n我们可以提供：\n- 爆款产品支持\n- 专属折扣码\n- 内容共创机会\n\n期待和您聊聊！\n{{contact}}\n\nTEDHAIR BD Team",
    },
  ];
  for (const t of templates) {
    await prisma.emailTemplate.create({ data: t });
  }

  // Sample influencers
  const sampleInfluencers = [
    { name: "Lisa_Style", platform: "tiktok", followers: 85000, sales30d: 320, tags: '["时尚","穿搭","美妆"]', sourceChannel: "标签搜索" },
    { name: "JennyHairQueen", platform: "instagram", followers: 120000, sales30d: 580, tags: '["假发","发型","美妆"]', sourceChannel: "达人广场" },
    { name: "时尚小美", platform: "xiaohongshu", followers: 45000, sales30d: 180, tags: '["时尚","穿搭","生活"]', sourceChannel: "相似推荐" },
    { name: "foodie_king", platform: "tiktok", followers: 200000, sales30d: 50, tags: '["美食","搞笑","生活"]', sourceChannel: "标签搜索" },
    { name: "BeautyByMia", platform: "youtube", followers: 95000, sales30d: 420, tags: '["美妆","发型","时尚"]', sourceChannel: "搜索结果" },
  ];

  for (const inf of sampleInfluencers) {
    await prisma.influencer.create({ data: inf });
  }

  console.log("Seed completed!");
  console.log("Login: admin@tedhair.com / admin123");
}

main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
