import { prisma } from "@/lib/db";
import CoursesClient from "./CoursesClient";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({ orderBy: { idPrefix: "asc" } });
  return <CoursesClient initialCourses={JSON.parse(JSON.stringify(courses))} />;
}
