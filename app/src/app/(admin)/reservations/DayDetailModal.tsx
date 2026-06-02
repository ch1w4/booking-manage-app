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
  isRecurring?: boolean;
};

// A4横: 297×210mm → 96dpi換算 1123×794px
const A4_W = 1123;
const A4_H = 794;

// モーダルヘッダー高さ
const HEADER_H = 44;
// 印刷用タイトル行高さ
const TITLE_H = 28;
// テーブルヘッダー (2行分)
const TABLE_HEADER_H = 42;
// データ行エリアの高さ
const ROWS_AREA_H = A4_H - HEADER_H - TITLE_H - TABLE_HEADER_H; // 680px

// 9:00〜21:00 の30分刻み (25行)
const TIME_ROWS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_ROWS.push("21:00");
const ROW_H = Math.floor(ROWS_AREA_H / TIME_ROWS.length); // 約27px

const SEATS = 11;

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

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
    if (seat === -1) {
      seat = seatEndTimes.length;
      seatEndTimes.push(0);
    }
    if (seat < SEATS) {
      result.set(r.id, seat);
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

  function getReservationAt(seat: number, timeRow: string) {
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

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/50 z-40 no-print" onClick={onClose} />

      {/* A4横サイズ固定モーダル */}
      <div
        className="fixed z-50 bg-white shadow-2xl no-print overflow-hidden"
        style={{
          width: A4_W,
          height: A4_H,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-4 border-b border-gray-200 bg-white flex-shrink-0"
          style={{ height: HEADER_H }}
        >
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800 text-sm">{dateLabel}</span>
            <span className="text-xs text-gray-400">{reservations.length}件</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded text-xs hover:bg-blue-700"
            >
              <Plus size={12} />
              予約追加
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs hover:bg-gray-200"
            >
              <Printer size={12} />
              印刷
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* テーブルエリア */}
        <div style={{ height: A4_H - HEADER_H, overflow: "hidden" }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              読み込み中...
            </div>
          ) : (
            <ScheduleTable
              dateLabel={dateLabel}
              reservations={reservations}
              seatMap={seatMap}
              timeRows={TIME_ROWS}
              rowH={ROW_H}
              titleH={TITLE_H}
              tableHeaderH={TABLE_HEADER_H}
              getReservationAt={getReservationAt}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      {/* 予約追加フォーム (小モーダル) */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-60" onClick={() => setShowAdd(false)} />
          <div
            className="fixed z-70 bg-white rounded-xl shadow-2xl p-5 no-print"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">予約追加 — {dateLabel}</h3>
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
                    <option key={c.id} value={c.id}>
                      {c.customerCode} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開始時間</label>
                  <select
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">終了時間</label>
                  <select
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "FLEX" | "FIXED_INSTANCE" })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="任意"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <div className="flex-1" />
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !form.customerId}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "追加中…" : "追加"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 印刷専用レイアウト */}
      <div className="print-only hidden">
        <ScheduleTable
          dateLabel={dateLabel}
          reservations={reservations}
          seatMap={seatMap}
          timeRows={TIME_ROWS}
          rowH={ROW_H}
          titleH={TITLE_H}
          tableHeaderH={TABLE_HEADER_H}
          getReservationAt={getReservationAt}
          onCancel={() => {}}
          isPrint
        />
      </div>
    </>
  );
}

function ScheduleTable({
  dateLabel,
  reservations,
  seatMap,
  timeRows,
  rowH,
  titleH,
  tableHeaderH,
  getReservationAt,
  onCancel,
  isPrint = false,
}: {
  dateLabel: string;
  reservations: Reservation[];
  seatMap: Map<number, number>;
  timeRows: string[];
  rowH: number;
  titleH: number;
  tableHeaderH: number;
  getReservationAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint?: boolean;
}) {
  const seats = Array.from({ length: SEATS }, (_, i) => i);
  const headerRowH = Math.floor(tableHeaderH / 2);

  return (
    <div style={{ overflow: "hidden" }}>
      {/* タイトル行 */}
      <div
        className="flex items-center justify-between px-3 bg-gray-50 border-b border-gray-200"
        style={{ height: titleH }}
      >
        <span className="text-xs text-gray-500 font-medium">ブース予約表</span>
        <span className="text-xs font-bold text-gray-700">{dateLabel}</span>
        <span className="text-xs text-gray-400">{reservations.length}件</span>
      </div>

      <table
        className="border-collapse w-full table-fixed"
        style={{ fontSize: "10px" }}
      >
        <colgroup>
          <col style={{ width: 52 }} />
          {seats.map((s) => (
            <React.Fragment key={s}>
              <col style={{ width: 20 }} />
              <col style={{ width: 30 }} />
              <col />
            </React.Fragment>
          ))}
        </colgroup>

        <thead>
          <tr style={{ height: headerRowH, backgroundColor: "#f3f4f6" }}>
            <th
              rowSpan={2}
              className="border border-gray-300 text-center font-medium text-gray-600 align-middle"
            >
              時間
            </th>
            {seats.map((s) => (
              <th
                key={s}
                colSpan={3}
                className="border border-gray-300 text-center font-semibold text-gray-700"
              >
                {s + 1}番
              </th>
            ))}
          </tr>
          <tr style={{ height: headerRowH, backgroundColor: "#f9fafb" }}>
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
            <tr key={timeRow} style={{ height: rowH }}>
              <td
                className="border border-gray-300 text-center text-gray-500 font-mono"
                style={{ fontSize: 9 }}
              >
                {timeRow}
              </td>
              {seats.map((s) => {
                const hit = getReservationAt(s, timeRow);
                if (!hit) {
                  return (
                    <React.Fragment key={`${s}-${timeRow}`}>
                      <td className="border border-gray-200 bg-white" />
                      <td className="border border-gray-200 bg-white" />
                      <td className="border border-gray-200 bg-white" />
                    </React.Fragment>
                  );
                }
                const { r, isFirst } = hit;
                const bg = r.type === "FIXED_INSTANCE" ? r.customer.course.color + "15" : "white";
                if (!isFirst) {
                  return (
                    <React.Fragment key={`${s}-${timeRow}`}>
                      <td className="border border-gray-200 text-center text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                      <td className="border border-gray-200 text-center text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                      <td className="border border-gray-200 text-gray-300" style={{ backgroundColor: bg }}>↓</td>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td className="border border-gray-200" style={{ backgroundColor: bg }} />
                    <td
                      className="border border-gray-200 text-center font-mono font-semibold"
                      style={{ backgroundColor: bg }}
                    >
                      {r.customer.customerCode}
                    </td>
                    <td
                      className="border border-gray-200 px-0.5 font-medium group relative overflow-hidden"
                      style={{ backgroundColor: bg, color: r.customer.course.color }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{r.customer.name}</span>
                        {!isPrint && r.id > 0 && (
                          <button
                            onClick={() => onCancel(r.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0 ml-0.5"
                            style={{ fontSize: 10 }}
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
    </div>
  );
}
