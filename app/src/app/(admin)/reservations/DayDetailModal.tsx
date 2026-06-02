"use client";

import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { X, Plus, Printer, Search } from "lucide-react";

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

const SEATS_TOP = [0, 1, 2, 3, 4, 5];
const SEATS_BOT = [6, 7, 8, 9, 10];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "21:00");

const TIME_ROWS: string[] = [];
for (let h = 9; h <= 21; h++) {
  TIME_ROWS.push(`${String(h).padStart(2, "0")}:00`);
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function assignSeats(reservations: Reservation[]): Map<number, number> {
  const sorted = [...reservations].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const endTimes: number[] = [];
  const result = new Map<number, number>();
  for (const r of sorted) {
    const start = toMin(r.startTime);
    let seat = endTimes.findIndex((e) => e <= start);
    if (seat === -1) seat = endTimes.length;
    if (seat < 11) {
      result.set(r.id, seat);
      endTimes[seat] = toMin(r.endTime);
    }
  }
  return result;
}

// ─── 顧客検索コンポーネント ───────────────────────────────────────
function CustomerSearch({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length === 0
    ? customers.slice(0, 20)
    : customers.filter(
        (c) =>
          c.name.includes(query) ||
          c.customerCode.includes(query) ||
          c.course.name.includes(query)
      ).slice(0, 20);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(c: Customer) {
    onChange(String(c.id));
    setSelectedLabel(`${c.customerCode} ${c.name}`);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
        <Search size={14} className="ml-2 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          placeholder="名前・IDで検索..."
          className="flex-1 px-2 py-1.5 text-sm outline-none bg-white"
        />
        {value && (
          <button
            onClick={() => { onChange(""); setSelectedLabel(""); setQuery(""); }}
            className="px-2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">見つかりません</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onMouseDown={() => select(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.course.color }}
                />
                <span className="font-mono text-gray-500 text-xs w-10 flex-shrink-0">
                  {c.customerCode}
                </span>
                <span className="font-medium text-gray-800">{c.name}</span>
                <span className="text-xs text-gray-400 ml-auto truncate">{c.course.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────
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
      const rowEnd = rowMin + 60;
      const s = toMin(r.startTime);
      const e = toMin(r.endTime);
      if (s < rowEnd && e > rowMin) {
        const prevRowMin = rowMin - 60;
        const isFirst = prevRowMin < toMin(TIME_ROWS[0]) || !(s < rowMin && e > prevRowMin);
        return { r, isFirst };
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
      setForm({ customerId: "", startTime: "10:00", endTime: "12:00", type: "FLEX", note: "" });
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

      {/* モーダル：スクロールあり */}
      <div
        className="fixed z-50 bg-white shadow-2xl no-print flex flex-col rounded-xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "95vw",
          maxWidth: 1500,
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800">{dateLabel}</span>
            <span className="text-xs text-gray-400">{reservations.length}件</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={14} /> 予約追加
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-900"
            >
              <Printer size={14} /> 印刷
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 予約追加フォーム（インライン） */}
        {showAdd && (
          <div className="border-b border-gray-200 px-4 py-3 bg-blue-50 flex-shrink-0">
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ minWidth: 220 }}>
                <label className="block text-xs font-medium text-gray-600 mb-1">顧客</label>
                <CustomerSearch
                  customers={customers}
                  value={form.customerId}
                  onChange={(id) => setForm({ ...form, customerId: id })}
                />
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
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* スクロール可能なテーブル */}
        <div className="overflow-auto flex-1 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
          ) : (
            <BoothTable
              dateLabel={dateLabel}
              reservations={reservations}
              seatMap={seatMap}
              timeRows={TIME_ROWS}
              getAt={getAt}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      {/* 印刷専用 */}
      <div className="print-only" style={{ display: "none" }}>
        <BoothTable
          dateLabel={dateLabel}
          reservations={reservations}
          seatMap={seatMap}
          timeRows={TIME_ROWS}
          getAt={getAt}
          onCancel={() => {}}
          isPrint
        />
      </div>
    </>
  );
}

// ─── 2段ブーステーブル ────────────────────────────────────────────
function BoothTable({
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
  const printRowMm = 6.0;
  const printSecHeaderMm = 8;
  const printTitleMm = 6;
  const outerBorder = "3px solid #1f2937";
  const sectionDivider = "3px solid #1f2937";

  return (
    <div style={isPrint ? { width: "281mm", fontFamily: "system-ui, sans-serif" } : {}}>
      <div
        style={
          isPrint
            ? { height: `${printTitleMm}mm`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", fontSize: 10 }
            : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", marginBottom: 4, fontSize: 12 }
        }
      >
        <span style={{ color: "#6b7280" }}>ブース予約表</span>
        <span style={{ fontWeight: "bold" }}>{dateLabel}</span>
        <span style={{ color: "#9ca3af" }}>{reservations.length}件</span>
      </div>

      <div style={{ border: outerBorder, display: "inline-block", minWidth: "100%" }}>
        <SectionTable seats={SEATS_TOP} timeRows={timeRows} getAt={getAt} onCancel={onCancel} isPrint={isPrint} printRowMm={printRowMm} printSecHeaderMm={printSecHeaderMm} />
        <div style={{ borderTop: sectionDivider }} />
        <SectionTable seats={SEATS_BOT} timeRows={timeRows} getAt={getAt} onCancel={onCancel} isPrint={isPrint} printRowMm={printRowMm} printSecHeaderMm={printSecHeaderMm} />
      </div>
    </div>
  );
}

// ─── 1段分テーブル ────────────────────────────────────────────────
function SectionTable({
  seats, timeRows, getAt, onCancel, isPrint, printRowMm, printSecHeaderMm,
}: {
  seats: number[];
  timeRows: string[];
  getAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint: boolean;
  printRowMm: number;
  printSecHeaderMm: number;
}) {
  const headerRowH = isPrint ? `${printSecHeaderMm / 2}mm` : "18px";
  const dataRowH = isPrint ? `${printRowMm}mm` : "24px";
  const fontSize = isPrint ? 8 : 11;

  return (
    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", fontSize }}>
      <colgroup>
        <col style={{ width: isPrint ? "9mm" : 52 }} />
        {seats.map((s) => (
          <React.Fragment key={s}>
            <col style={{ width: isPrint ? "4mm" : 22 }} />
            <col style={{ width: isPrint ? "6mm" : 32 }} />
            <col />
          </React.Fragment>
        ))}
      </colgroup>
      <thead>
        <tr style={{ height: headerRowH, backgroundColor: "#f3f4f6" }}>
          <th rowSpan={2} style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 600, color: "#4b5563", verticalAlign: "middle" }}>
            時間
          </th>
          {seats.map((s) => (
            <th key={s} colSpan={3} style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 700, color: "#1f2937" }}>
              {s + 1}番
            </th>
          ))}
        </tr>
        <tr style={{ height: headerRowH, backgroundColor: "#f9fafb" }}>
          {seats.map((s) => (
            <React.Fragment key={s}>
              <th style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 400, color: "#6b7280" }}>印</th>
              <th style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 400, color: "#6b7280" }}>ID</th>
              <th style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 400, color: "#6b7280" }}>氏名</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {timeRows.map((timeRow) => (
          <tr key={timeRow} style={{ height: dataRowH }}>
            <td style={{ border: "1px solid #e5e7eb", textAlign: "center", color: "#6b7280", fontFamily: "monospace", fontSize: isPrint ? 7 : 9 }}>
              {timeRow}
            </td>
            {seats.map((s) => {
              const hit = getAt(s, timeRow);
              if (!hit) {
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td style={{ border: "1px solid #f3f4f6" }} />
                    <td style={{ border: "1px solid #f3f4f6" }} />
                    <td style={{ border: "1px solid #f3f4f6" }} />
                  </React.Fragment>
                );
              }
              const { r, isFirst } = hit;
              const bg = r.type === "FIXED_INSTANCE" ? r.customer.course.color + "18" : "white";
              if (!isFirst) {
                return (
                  <React.Fragment key={`${s}-${timeRow}`}>
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg, textAlign: "center", color: "#d1d5db" }}>↓</td>
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg, textAlign: "center", color: "#d1d5db" }}>↓</td>
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg, color: "#d1d5db" }}>↓</td>
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={`${s}-${timeRow}`}>
                  <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg }} />
                  <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg, textAlign: "center", fontFamily: "monospace", fontWeight: 600 }}>
                    {r.customer.customerCode}
                  </td>
                  <td style={{ border: "1px solid #f3f4f6", backgroundColor: bg, color: r.customer.course.color, fontWeight: 600, overflow: "hidden", paddingLeft: 2 }} className="group relative">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer.name}</span>
                      {!isPrint && r.id > 0 && (
                        <button onClick={() => onCancel(r.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0" style={{ fontSize: 10, marginLeft: 2 }}>×</button>
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
