"use client";

import React, { useEffect, useState } from "react";
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
};

const SEATS_TOP = [0, 1, 2, 3, 4, 5];       // 1〜6番
const SEATS_BOT = [6, 7, 8, 9, 10];          // 7〜11番

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

const TIME_ROWS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_ROWS.push("21:00");

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function assignSeats(reservations: Reservation[]): Map<number, number> {
  const sorted = [...reservations].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const seatEndTimes: number[] = [];
  const result = new Map<number, number>();
  for (const r of sorted) {
    const start = toMin(r.startTime);
    let seat = seatEndTimes.findIndex((end) => end <= start);
    if (seat === -1) seat = seatEndTimes.length;
    if (seat < 11) {
      result.set(r.id, seat);
      if (!seatEndTimes[seat]) seatEndTimes[seat] = 0;
      seatEndTimes[seat] = toMin(r.endTime);
    }
  }
  return result;
}

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
  const [form, setForm] = useState({
    customerId: "",
    startTime: "10:00",
    endTime: "12:00",
    type: "FLEX" as "FLEX" | "FIXED_INSTANCE",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const dateLabel = format(parseISO(date), "yyyy年M月d日（EEEEE）", { locale: ja });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reservations?date=${date}&includeRecurring=true`)
      .then((r) => r.json())
      .then(setReservations)
      .finally(() => setLoading(false));
  }, [date]);

  const seatMap = assignSeats(reservations);

  function getAt(seat: number, timeRow: string) {
    for (const r of reservations) {
      if (seatMap.get(r.id) !== seat) continue;
      const rowMin = toMin(timeRow);
      const s = toMin(r.startTime);
      const e = toMin(r.endTime);
      if (rowMin >= s && rowMin < e) return { r, isFirst: rowMin === s };
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
      setReservations((prev) =>
        [...prev, created].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
      setShowAdd(false);
    }
    setSaving(false);
  }

  async function handleCancel(id: number) {
    if (id < 0) return;
    if (!confirm("この予約をキャンセルしますか？")) return;
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }

  const tableProps = { reservations, seatMap, timeRows: TIME_ROWS, getAt, onCancel: handleCancel };

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/50 z-40 no-print" onClick={onClose} />

      {/* モーダル：画面サイズ自由・スクロール可 */}
      <div
        className="fixed z-50 bg-white shadow-2xl no-print flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "95vw",
          maxWidth: 1500,
          maxHeight: "92vh",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800">{dateLabel}</span>
            <span className="text-xs text-gray-400">{reservations.length}件</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={14} /> 予約追加
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-900"
            >
              <Printer size={14} /> 印刷
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* スクロール可能なコンテンツ */}
        <div className="overflow-auto flex-1 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
          ) : (
            <BoothLayout dateLabel={dateLabel} {...tableProps} />
          )}
        </div>
      </div>

      {/* 予約追加モーダル */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowAdd(false)} />
          <div
            className="fixed z-[70] bg-white rounded-xl shadow-2xl p-5 no-print"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-gray-800">予約追加 — {dateLabel}</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">顧客</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">選択してください</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開始</label>
                  <select value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">終了</label>
                  <select value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "FLEX" | "FIXED_INSTANCE" })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                  <option value="FLEX">フレックス</option>
                  <option value="FIXED_INSTANCE">固定</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder="任意" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">キャンセル</button>
              <button onClick={handleAdd} disabled={saving || !form.customerId} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? "追加中…" : "追加"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 印刷専用 */}
      <div className="print-only hidden">
        <BoothLayout dateLabel={dateLabel} {...tableProps} isPrint />
      </div>
    </>
  );
}

// ─── 2段レイアウト ────────────────────────────────────────────────
function BoothLayout({
  dateLabel,
  reservations,
  seatMap,
  timeRows,
  getAt,
  onCancel,
  isPrint = false,
}: {
  dateLabel: string;
  reservations: Reservation[];
  seatMap: Map<number, number>;
  timeRows: string[];
  getAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint?: boolean;
}) {
  return (
    <div>
      {/* 印刷タイトル */}
      {isPrint && (
        <div className="flex items-center justify-between mb-1 px-0.5">
          <span className="text-xs text-gray-500">ブース予約表</span>
          <span className="font-bold text-sm">{dateLabel}</span>
          <span className="text-xs text-gray-400">{reservations.length}件</span>
        </div>
      )}

      {/* 外枠（太線） */}
      <div style={{ border: "2.5px solid #1f2937", display: "inline-block", minWidth: "100%" }}>
        {/* 上段: 1〜6番 */}
        <SectionTable
          seats={SEATS_TOP}
          timeRows={timeRows}
          getAt={getAt}
          onCancel={onCancel}
          isPrint={isPrint}
        />

        {/* 段区切り（太線） */}
        <div style={{ borderTop: "2.5px solid #1f2937" }} />

        {/* 下段: 7〜11番 */}
        <SectionTable
          seats={SEATS_BOT}
          timeRows={timeRows}
          getAt={getAt}
          onCancel={onCancel}
          isPrint={isPrint}
        />
      </div>
    </div>
  );
}

// ─── 1セクション分のテーブル ──────────────────────────────────────
function SectionTable({
  seats,
  timeRows,
  getAt,
  onCancel,
  isPrint,
}: {
  seats: number[];
  timeRows: string[];
  getAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint: boolean;
}) {
  return (
    <table
      className="border-collapse w-full"
      style={{ fontSize: isPrint ? 9 : 11, tableLayout: "fixed" }}
    >
      <colgroup>
        <col style={{ width: isPrint ? 42 : 52 }} />
        {seats.map((s) => (
          <React.Fragment key={s}>
            <col style={{ width: isPrint ? 18 : 22 }} />
            <col style={{ width: isPrint ? 26 : 32 }} />
            <col />
          </React.Fragment>
        ))}
      </colgroup>

      {/* 2段ヘッダー */}
      <thead>
        <tr style={{ height: isPrint ? 16 : 22, backgroundColor: "#f3f4f6" }}>
          <th rowSpan={2} className="border border-gray-300 text-center font-medium text-gray-600 align-middle" style={{ fontSize: isPrint ? 8 : 10 }}>
            時間
          </th>
          {seats.map((s) => (
            <th key={s} colSpan={3} className="border border-gray-300 text-center font-bold text-gray-800">
              {s + 1}番
            </th>
          ))}
        </tr>
        <tr style={{ height: isPrint ? 14 : 18, backgroundColor: "#f9fafb" }}>
          {seats.map((s) => (
            <React.Fragment key={s}>
              <th className="border border-gray-300 text-center font-normal text-gray-500">印</th>
              <th className="border border-gray-300 text-center font-normal text-gray-500">ID</th>
              <th className="border border-gray-300 text-center font-normal text-gray-500">氏名</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {timeRows.map((timeRow) => (
          <tr key={timeRow} style={{ height: isPrint ? 14 : 22 }}>
            <td className="border border-gray-200 text-center text-gray-500 font-mono" style={{ fontSize: isPrint ? 8 : 9 }}>
              {timeRow}
            </td>
            {seats.map((s) => {
              const hit = getAt(s, timeRow);
              if (!hit) {
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td className="border border-gray-100 bg-white" />
                    <td className="border border-gray-100 bg-white" />
                    <td className="border border-gray-100 bg-white" />
                  </React.Fragment>
                );
              }
              const { r, isFirst } = hit;
              const bg = r.type === "FIXED_INSTANCE" ? r.customer.course.color + "15" : "white";
              if (!isFirst) {
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td className="border border-gray-100 text-center text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                    <td className="border border-gray-100 text-center text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                    <td className="border border-gray-100 text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={`${s}-${timeRow}`}>
                  <td className="border border-gray-100" style={{ backgroundColor: bg }} />
                  <td className="border border-gray-100 text-center font-mono font-semibold" style={{ backgroundColor: bg }}>
                    {r.customer.customerCode}
                  </td>
                  <td
                    className="border border-gray-100 px-0.5 font-medium overflow-hidden group relative"
                    style={{ backgroundColor: bg, color: r.customer.course.color }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{r.customer.name}</span>
                      {!isPrint && r.id > 0 && (
                        <button
                          onClick={() => onCancel(r.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0 ml-0.5 text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </React.Fragment>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
