import { prisma } from "@/lib/db";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, courses] = await Promise.all([
    prisma.customer.findMany({
      include: { course: true },
      orderBy: { customerCode: "asc" },
    }),
    prisma.course.findMany({ orderBy: { idPrefix: "asc" } }),
  ]);

  return (
    <CustomersClient
      initialCustomers={JSON.parse(JSON.stringify(customers))}
      courses={JSON.parse(JSON.stringify(courses))}
    />
  );
}
