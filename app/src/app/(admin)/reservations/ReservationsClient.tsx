"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Edit2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

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
  const [reservations, setReservations] = useState(initialReservations);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [form, setForm] = useState({
    customerId: "",
    startTime: "10:00",
    endTime: "12:00",
    type: "FLEX" as "FLEX" | "FIXED_INSTANCE",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const monthDate = parseISO(`${currentMonth}-01`);
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const firstDayOfWeek = getDay(startOfMonth(monthDate));

  function getDateReservations(date: Date) {
    return reservations.filter((r) => isSameDay(parseISO(r.date), date));
  }

  function openNew(date: Date) {
    setSelectedDate(date);
    setEditing(null);
    setForm({ customerId: "", startTime: "10:00", endTime: "12:00", type: "FLEX", note: "" });
    setShowForm(true);
  }

  function openEdit(r: Reservation) {
    setEditing(r);
    setSelectedDate(parseISO(r.date));
    setForm({
      customerId: String(r.customerId),
      startTime: r.startTime,
      endTime: r.endTime,
      type: r.type,
      note: r.note ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!selectedDate || !form.customerId) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/reservations/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: format(selectedDate, "yyyy-MM-dd"),
            startTime: form.startTime,
            endTime: form.endTime,
            note: form.note || null,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setReservations((prev) =>
            prev.map((r) => (r.id === editing.id ? updated : r))
          );
        }
      } else {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: Number(form.customerId),
            date: format(selectedDate, "yyyy-MM-dd"),
            startTime: form.startTime,
            endTime: form.endTime,
            type: form.type,
            note: form.note || undefined,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setReservations((prev) => [...prev, created]);
        }
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: number) {
    if (!confirm("この予約をキャンセルしますか？")) return;
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReservations((prev) => prev.filter((r) => r.id !== id));
    }
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
            return (
              <div
                key={day.toISOString()}
                className={`border-b border-r border-gray-100 min-h-24 p-1 ${
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
                  <button
                    onClick={() => openNew(day)}
                    className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dayReservations.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-1"
                      style={{ backgroundColor: r.customer.course.color + "30", color: r.customer.course.color }}
                      onClick={() => openEdit(r)}
                    >
                      <span className="font-medium">{r.startTime}</span>
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

      {showForm && selectedDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {editing ? "予約を編集" : "予約を追加"}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {format(selectedDate, "M月d日（EEEEE）", { locale: ja })}
                </span>
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">顧客</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerCode} - {c.name} ({c.course.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                  <select
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                  <select
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "FLEX" | "FIXED_INSTANCE" })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FLEX">フレックス</option>
                    <option value="FIXED_INSTANCE">固定</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="任意"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              {editing && (
                <button
                  onClick={() => handleCancel(editing.id)}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editing && !form.customerId)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
