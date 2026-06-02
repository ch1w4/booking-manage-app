"use client";

import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { X, Plus, Printer } from "lucide-react";

type Course = { id: number; name: string; color: string };
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
  isRecurring?: boolean;
};

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

// 時間(HH:MM)を分に変換
function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 予約を重複しないよう列（席）に割り当て
function assignSeats(reservations: Reservation[]): Map<number, number> {
  const sorted = [...reservations].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const seatEndTimes: number[] = [];
  const result = new Map<number, number>();
  for (const r of sorted) {
    const start = toMin(r.startTime);
    let seat = seatEndTimes.findIndex((end) => end <= start);
    if (seat === -1) {
      seat = seatEndTimes.length;
      seatEndTimes.push(0);
    }
    result.set(r.id, seat);
    seatEndTimes[seat] = toMin(r.endTime);
  }
  return result;
}

// 30分刻みの時間行リスト（9:00〜21:00）
const TIME_ROWS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_ROWS.push("21:00");

export default function DayDetailModal({
  date,
  customers,
  onClose,
}: {
  date: string;
  customers: Customer[];
  onClose: () => void;
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customerId: "", startTime: "10:00", endTime: "12:00", type: "FLEX" as "FLEX" | "FIXED_INSTANCE", note: "" });
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const dateObj = parseISO(date);
  const dateLabel = format(dateObj, "yyyy年M月d日（EEEEE）", { locale: ja });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reservations?date=${date}&includeRecurring=true`)
      .then((r) => r.json())
      .then(setReservations)
      .finally(() => setLoading(false));
  }, [date]);

  const seatMap = assignSeats(reservations);
  const seatCount = 11;

  // 特定時間帯に存在する予約を取得
  function getReservationAt(seat: number, timeRow: string): { r: Reservation; isFirst: boolean } | null {
    for (const r of reservations) {
      if (seatMap.get(r.id) !== seat) continue;
      const rowMin = toMin(timeRow);
      const startMin = toMin(r.startTime);
      const endMin = toMin(r.endTime);
      if (rowMin >= startMin && rowMin < endMin) {
        return { r, isFirst: rowMin === startMin };
      }
    }
    return null;
  }

  async function handleAdd() {
    if (!form.customerId) return;
    setSaving(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: Number(form.customerId),
        date,
        startTime: form.startTime,
        endTime: form.endTime,
        type: form.type,
        note: form.note || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setReservations((prev) => [...prev, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setShowAdd(false);
    }
    setSaving(false);
  }

  async function handleCancel(id: number) {
    if (id < 0) return; // 固定予約（仮想）はキャンセル不可（顧客画面から操作）
    if (!confirm("この予約をキャンセルしますか？")) return;
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/50 z-40 no-print" onClick={onClose} />

      {/* モーダル本体 */}
      <div className="fixed inset-4 md:inset-8 bg-white rounded-xl shadow-2xl z-50 flex flex-col no-print overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">{dateLabel}</h2>
            <p className="text-sm text-gray-500">{reservations.length}件の予約</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={15} />
              予約追加
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200"
            >
              <Printer size={15} />
              印刷
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 予約追加フォーム */}
        {showAdd && (
          <div className="border-b border-gray-200 px-5 py-3 bg-blue-50 flex-shrink-0">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">顧客</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">選択</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerCode} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開始</label>
                <select
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">終了</label>
                <select
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "FLEX" | "FIXED_INSTANCE" })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="FLEX">フレックス</option>
                  <option value="FIXED_INSTANCE">固定</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-32"
                  placeholder="任意"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !form.customerId}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "追加中…" : "追加"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-500 text-sm hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* テーブル本体 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="text-center py-12 text-gray-400">読み込み中...</p>
          ) : (
            <div ref={printRef}>
              <ScheduleTable
                date={date}
                dateLabel={dateLabel}
                reservations={reservations}
                seatMap={seatMap}
                seatCount={seatCount}
                timeRows={TIME_ROWS}
                getReservationAt={getReservationAt}
                onCancel={handleCancel}
              />
            </div>
          )}
        </div>
      </div>

      {/* 印刷用（print時のみ表示） */}
      <div className="print-only hidden">
        <ScheduleTable
          date={date}
          dateLabel={dateLabel}
          reservations={reservations}
          seatMap={seatMap}
          seatCount={seatCount}
          timeRows={TIME_ROWS}
          getReservationAt={getReservationAt}
          onCancel={() => {}}
          isPrint
        />
      </div>
    </>
  );
}

function ScheduleTable({
  date,
  dateLabel,
  reservations,
  seatMap,
  seatCount,
  timeRows,
  getReservationAt,
  onCancel,
  isPrint = false,
}: {
  date: string;
  dateLabel: string;
  reservations: Reservation[];
  seatMap: Map<number, number>;
  seatCount: number;
  timeRows: string[];
  getReservationAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint?: boolean;
}) {
  const seats = Array.from({ length: Math.max(seatCount, 1) }, (_, i) => i);

  return (
    <div className={isPrint ? "p-4" : "p-4 min-w-max"}>
      {/* 印刷ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-500 mr-3">ブース予約表</span>
          <span className="font-bold text-gray-800">{dateLabel}</span>
        </div>
        <span className="text-sm text-gray-600">{reservations.length}件</span>
      </div>

      <table className="border-collapse text-xs w-full">
        <thead>
          <tr className="bg-gray-100">
            <th
              rowSpan={2}
              className="border border-gray-300 px-2 py-1.5 text-center w-20 font-medium text-gray-600 align-middle"
            >
              時間
            </th>
            {seats.map((s) => (
              <th
                key={s}
                colSpan={3}
                className="border border-gray-300 px-2 py-1.5 text-center font-medium text-gray-700"
              >
                {s + 1}番
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 text-gray-500">
            {seats.map((s) => (
              <React.Fragment key={s}>
                <th className="border border-gray-300 px-1 py-1 w-8 font-normal">印</th>
                <th className="border border-gray-300 px-1 py-1 w-16 font-normal">ID</th>
                <th className="border border-gray-300 px-2 py-1 font-normal">氏名</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeRows.map((timeRow) => (
            <tr key={timeRow} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-2 py-1 text-center text-gray-500 font-mono whitespace-nowrap">
                {timeRow}
              </td>
              {seats.map((s) => {
                const hit = getReservationAt(s, timeRow);
                if (!hit) {
                  return (
                    <React.Fragment key={`${s}-${timeRow}`}>
                      <td className="border border-gray-300 px-1 py-1 w-8 bg-white" />
                      <td className="border border-gray-300 px-1 py-1 w-16 bg-white" />
                      <td className="border border-gray-300 px-2 py-1 bg-white" />
                    </React.Fragment>
                  );
                }
                const { r, isFirst } = hit;
                const isFixed = r.type === "FIXED_INSTANCE";
                const bg = isFixed ? r.customer.course.color + "18" : "white";
                if (!isFirst) {
                  return (
                    <React.Fragment key={`${s}-${timeRow}`}>
                      <td className="border border-gray-300 px-1 py-1" style={{ backgroundColor: bg }} />
                      <td className="border border-gray-300 px-1 py-1 text-center text-gray-400" style={{ backgroundColor: bg }}>↓</td>
                      <td className="border border-gray-300 px-2 py-1 text-gray-400" style={{ backgroundColor: bg }}>↓</td>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td className="border border-gray-300 px-1 py-1" style={{ backgroundColor: bg }} />
                    <td className="border border-gray-300 px-1 py-1 font-mono font-medium" style={{ backgroundColor: bg }}>
                      {r.customer.customerCode}
                    </td>
                    <td
                      className="border border-gray-300 px-2 py-1 font-medium group relative"
                      style={{ backgroundColor: bg, color: r.customer.course.color }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate max-w-[6rem]">{r.customer.name}</span>
                        {!isPrint && r.id > 0 && (
                          <button
                            onClick={() => onCancel(r.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs leading-none"
                            title="キャンセル"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {isFirst && r.note && (
                        <div className="text-xs text-gray-400 truncate">{r.note}</div>
                      )}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {reservations.length === 0 && (
        <p className="text-center py-8 text-gray-400">この日の予約はありません</p>
      )}
    </div>
  );
}
