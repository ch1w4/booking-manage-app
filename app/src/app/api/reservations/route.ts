import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { startOfDay, endOfDay, getDay } from "date-fns";

const createSchema = z.object({
  customerId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.enum(["FLEX", "FIXED_INSTANCE"]).default("FLEX"),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const customerId = searchParams.get("customerId");
  const includeRecurring = searchParams.get("includeRecurring") === "true";

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      ...(date && { date: { gte: startOfDay(new Date(date)), lte: endOfDay(new Date(date)) } }),
      ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
      ...(customerId && { customerId: Number(customerId) }),
    },
    include: { customer: { include: { course: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // 固定予約を当日分として合成
  if (date && includeRecurring) {
    const targetDate = new Date(date);
    const dow = getDay(targetDate);

    const slots = await prisma.recurringSlot.findMany({
      where: {
        dayOfWeek: dow,
        active: true,
        startDate: { lte: targetDate },
        OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
      },
      include: { customer: { include: { course: true } } },
    });

    // すでに同じ日に FIXED_INSTANCE が入っていない場合だけ追加
    const existingCustomerIds = new Set(
      reservations.filter((r) => r.type === "FIXED_INSTANCE").map((r) => r.customerId)
    );

    const syntheticReservations = slots
      .filter((s) => !existingCustomerIds.has(s.customerId))
      .map((s) => ({
        id: -(s.id), // 負のIDで固定予約由来を識別
        customerId: s.customerId,
        customer: s.customer,
        date: targetDate,
        startTime: s.startTime,
        endTime: s.endTime,
        type: "FIXED_INSTANCE" as const,
        status: "CONFIRMED" as const,
        note: null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        isRecurring: true,
      }));

    return NextResponse.json([...reservations, ...syntheticReservations].sort(
      (a, b) => a.startTime.localeCompare(b.startTime)
    ));
  }

  return NextResponse.json(reservations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date),
    },
    include: { customer: { include: { course: true } } },
  });

  return NextResponse.json(reservation, { status: 201 });
}
