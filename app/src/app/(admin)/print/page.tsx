import { prisma } from "@/lib/db";
import { format, startOfDay, endOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import PrintSchedule from "./PrintSchedule";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const targetDate = date ? new Date(date) : new Date();
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      status: "CONFIRMED",
    },
    include: { customer: { include: { course: true } } },
    orderBy: { startTime: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-bold text-gray-800">印刷</h1>
        <div className="flex items-center gap-3">
          <form>
            <input
              type="date"
              name="date"
              defaultValue={format(targetDate, "yyyy-MM-dd")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="ml-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm"
            >
              表示
            </button>
          </form>
          <button
            id="print-btn"
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700"
          >
            印刷
          </button>
        </div>
      </div>

      <PrintSchedule
        reservations={JSON.parse(JSON.stringify(reservations))}
        date={format(targetDate, "yyyy年M月d日（EEEEE）", { locale: ja })}
        dateRaw={format(targetDate, "yyyy-MM-dd")}
      />
    </div>
  );
}
