"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

type Customer = { id: number; customerCode: string; name: string };
type RecurringSlot = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

export default function RecurringModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<RecurringSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: "10:00",
    endTime: "12:00",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/recurring?customerId=${customer.id}`)
      .then((r) => r.json())
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [customer.id]);

  async function handleAdd() {
    setSaving(true);
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        ...form,
        endDate: form.endDate || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setSlots((prev) => [...prev, created]);
      setShowAdd(false);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-800">固定予約</h2>
            <p className="text-sm text-gray-500">
              {customer.customerCode} - {customer.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
        ) : (
          <div className="space-y-2 mb-4">
            {slots.length === 0 && !showAdd && (
              <p className="text-sm text-gray-400 text-center py-4">固定予約なし</p>
            )}
            {slots.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    毎週{DAY_LABELS[s.dayOfWeek]}曜日 {s.startTime}〜{s.endTime}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.startDate.slice(0, 10)} から
                    {s.endDate ? ` ${s.endDate.slice(0, 10)} まで` : "（期限なし）"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">曜日</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {DAY_LABELS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}曜日
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開始日</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開始時間</label>
                <select
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">終了時間</label>
                <select
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                終了日（任意）
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={15} />
            固定予約を追加
          </button>
        )}
      </div>
    </div>
  );
}
