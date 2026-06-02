import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const courses = [
    {
      name: "MOS資格試験対策講座",
      idPrefix: 1,
      color: "#3B82F6",
      description: "Microsoft Office Specialist 資格取得を目指すコース",
    },
    {
      name: "子ども向けITプログラミング講座",
      idPrefix: 5,
      color: "#10B981",
      description: "プログラミング・IT基礎・ネットワークを学ぶ子ども向けコース",
    },
    {
      name: "子ども向け本格プログラミング講座",
      idPrefix: 8,
      color: "#F59E0B",
      description: "マイクラ活用・本格的なプログラミングを学ぶ子ども向けコース",
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { idPrefix: course.idPrefix },
      update: {},
      create: course,
    });
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin";
  const hash = await bcrypt.hash(adminPassword, 12);
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { passwordHash: hash },
    create: { username: adminUsername, passwordHash: hash },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
