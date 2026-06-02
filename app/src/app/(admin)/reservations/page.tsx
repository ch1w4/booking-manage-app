import { prisma } from "@/lib/db";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ReservationsClient from "./ReservationsClient";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const targetDate = date ? new Date(date) : new Date();

  const from = startOfMonth(targetDate);
  const to = endOfMonth(targetDate);

  const [reservations, customers, courses] = await Promise.all([
    prisma.reservation.findMany({
      where: { date: { gte: from, lte: to }, status: "CONFIRMED" },
      include: { customer: { include: { course: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.customer.findMany({
      include: { course: true },
      orderBy: { customerCode: "asc" },
    }),
    prisma.course.findMany({ orderBy: { idPrefix: "asc" } }),
  ]);

  return (
    <ReservationsClient
      initialReservations={JSON.parse(JSON.stringify(reservations))}
      customers={JSON.parse(JSON.stringify(customers))}
      courses={JSON.parse(JSON.stringify(courses))}
      currentMonth={format(targetDate, "yyyy-MM")}
    />
  );
}
