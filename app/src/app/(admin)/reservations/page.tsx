import { prisma } from "@/lib/db";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  startOfDay,
  endOfDay,
} from "date-fns";
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
  const days = eachDayOfInterval({ start: from, end: to });

  const [reservations, customers, courses, recurringSlots] = await Promise.all([
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
    prisma.recurringSlot.findMany({
      where: {
        active: true,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      include: { customer: { include: { course: true } } },
    }),
  ]);

  // RecurringSlot を月の各日に合成（既存の FIXED_INSTANCE と重複しない分のみ）
  const syntheticReservations: typeof reservations = [];
  for (const day of days) {
    const dow = getDay(day);
    for (const slot of recurringSlots) {
      if (slot.dayOfWeek !== dow) continue;
      if (startOfDay(day) < startOfDay(slot.startDate)) continue;
      if (slot.endDate && startOfDay(day) > startOfDay(slot.endDate)) continue;

      const alreadyExists = reservations.some(
        (r) =>
          r.customerId === slot.customerId &&
          isSameDay(r.date, day) &&
          r.type === "FIXED_INSTANCE"
      );
      if (alreadyExists) continue;

      syntheticReservations.push({
        id: -(slot.id * 100 + dow),
        customerId: slot.customerId,
        customer: slot.customer,
        date: startOfDay(day),
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: "FIXED_INSTANCE",
        status: "CONFIRMED",
        note: null,
        createdAt: slot.createdAt,
        updatedAt: slot.updatedAt,
      } as (typeof reservations)[number]);
    }
  }

  const allReservations = [...reservations, ...syntheticReservations].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.startTime.localeCompare(b.startTime)
  );

  return (
    <ReservationsClient
      initialReservations={JSON.parse(JSON.stringify(allReservations))}
      customers={JSON.parse(JSON.stringify(customers))}
      courses={JSON.parse(JSON.stringify(courses))}
      currentMonth={format(targetDate, "yyyy-MM")}
    />
  );
}
