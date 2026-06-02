import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const courseSchema = z.object({
  name: z.string().min(1),
  idPrefix: z.number().int().min(1).max(9),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: z.string().optional(),
});

export async function GET() {
  const courses = await prisma.course.findMany({ orderBy: { idPrefix: "asc" } });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const course = await prisma.course.create({ data: parsed.data });
  return NextResponse.json(course, { status: 201 });
}
