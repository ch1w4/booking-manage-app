import { prisma } from "@/lib/db";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { Calendar, Clock, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const tomorrowStart = startOfDay(addDays(today, 1));
  const tomorrowEnd = endOfDay(addDays(today, 1));

  const [todayReservations, tomorrowReservations, totalCustomers] = await Promise.all([
    prisma.reservation.findMany({
      where: { date: { gte: todayStart, lte: todayEnd }, status: "CONFIRMED" },
      include: { customer: { include: { course: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.reservation.findMany({
      where: { date: { gte: tomorrowStart, lte: tomorrowEnd }, status: "CONFIRMED" },
      include: { customer: { include: { course: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.customer.count(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">ダッシュボード</h1>
        <p className="text-sm text-gray-500">
          {format(today, "yyyy年M月d日（EEEEE）", { locale: ja })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">本日の予約</p>
              <p className="text-2xl font-bold text-gray-800">{todayReservations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Clock size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">明日の予約</p>
              <p className="text-2xl font-bold text-gray-800">{tomorrowReservations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">顧客総数</p>
              <p className="text-2xl font-bold text-gray-800">{totalCustomers}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">本日の予約</h2>
            <Link
              href={`/print?date=${format(today, "yyyy-MM-dd")}`}
              className="text-xs text-blue-600 hover:underline"
            >
              印刷
            </Link>
          </div>
          {todayReservations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">予約なし</p>
          ) : (
            <div className="space-y-2">
              {todayReservations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                >
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.customer.course.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.customer.name}
                      <span className="text-xs text-gray-400 ml-1">
                        #{r.customer.customerCode}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.startTime} 〜 {r.endTime}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: r.customer.course.color }}
                  >
                    {r.type === "FIXED_INSTANCE" ? "固定" : "フレックス"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-800 mb-4">明日の予約</h2>
          {tomorrowReservations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">予約なし</p>
          ) : (
            <div className="space-y-2">
              {tomorrowReservations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                >
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.customer.course.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.customer.name}
                      <span className="text-xs text-gray-400 ml-1">
                        #{r.customer.customerCode}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.startTime} 〜 {r.endTime}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
