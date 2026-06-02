import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

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

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      ...(date && { date: new Date(date) }),
      ...(from && to && {
        date: { gte: new Date(from), lte: new Date(to) },
      }),
      ...(customerId && { customerId: Number(customerId) }),
    },
    include: { customer: { include: { course: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

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
