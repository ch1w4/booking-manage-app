import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const customerSchema = z.object({
  customerCode: z.string().regex(/^\d{4}$/),
  name: z.string().min(1),
  courseId: z.number().int().positive(),
  lineUserId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const courseId = searchParams.get("courseId");

  const customers = await prisma.customer.findMany({
    where: {
      ...(query && {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { customerCode: { contains: query } },
        ],
      }),
      ...(courseId && { courseId: Number(courseId) }),
    },
    include: { course: true },
    orderBy: { customerCode: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const course = await prisma.course.findFirst({
    where: { idPrefix: Number(parsed.data.customerCode[0]) },
  });
  if (!course) {
    return NextResponse.json(
      { error: "IDの先頭数字に対応する講座が存在しません" },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.create({
    data: { ...parsed.data, courseId: course.id },
    include: { course: true },
  });
  return NextResponse.json(customer, { status: 201 });
}
