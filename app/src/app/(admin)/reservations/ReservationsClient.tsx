"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import DayDetailModal from "./DayDetailModal";

type Course = { id: number; name: string; idPrefix: number; color: string };
type Customer = { id: number; customerCode: string; name: string; course: Course };
type Reservation = {
  id: number;
  customerId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: "FLEX" | "FIXED_INSTANCE";
  status: string;
  note: string | null;
  customer: Customer;
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function ReservationsClient({
  initialReservations,
  customers,
  courses,
  currentMonth,
}: {
  initialReservations: Reservation[];
  customers: Customer[];
  courses: Course[];
  currentMonth: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthDate = parseISO(`${currentMonth}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const firstDayOfWeek = getDay(startOfMonth(monthDate));

  function getDateReservations(date: Date) {
    return initialReservations.filter((r) => isSameDay(parseISO(r.date), date));
  }

  function navigate(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    router.push(`/reservations?date=${format(next, "yyyy-MM-dd")}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">予約管理</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-gray-700 w-28 text-center">
            {format(monthDate, "yyyy年M月", { locale: ja })}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">日付をクリックすると詳細・予約追加・印刷ができます</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-r border-gray-100 min-h-24" />
          ))}
          {days.map((day, i) => {
            const dayReservations = getDateReservations(day);
            const dow = getDay(day);
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(dateStr)}
                className={`border-b border-r border-gray-100 min-h-24 p-1 cursor-pointer transition-colors hover:bg-blue-50 ${
                  (i + firstDayOfWeek + 1) % 7 === 0 ? "border-r-0" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-600"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayReservations.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 leading-none font-medium">
                      {dayReservations.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayReservations.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="text-xs px-1 py-0.5 rounded truncate"
                      style={{
                        backgroundColor: r.customer.course.color + "30",
                        color: r.customer.course.color,
                      }}
                    >
                      <span className="font-medium">{r.startTime}</span>{" "}
                      <span className="truncate">{r.customer.name}</span>
                    </div>
                  ))}
                  {dayReservations.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayReservations.length - 3}件</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          customers={customers}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
