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

const SEATS_TOP = [0, 1, 2, 3, 4, 5];   // 1〜6番
const SEATS_BOT = [6, 7, 8, 9, 10];     // 7〜11番

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

// モーダルヘッダー固定高さ
const MODAL_HEADER_H = 44;
// 各セクションのテーブルヘッダー高さ（2行）
const SECTION_HEADER_H = 36;
// 段区切り太線
const DIVIDER_H = 3;

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
  const [rowH, setRowH] = useState(18);
  const [form, setForm] = useState({
    customerId: "",
    startTime: "10:00",
    endTime: "12:00",
    type: "FLEX" as "FLEX" | "FIXED_INSTANCE",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const dateLabel = format(parseISO(date), "yyyy年M月d日（EEEEE）", { locale: ja });

  // 行高を画面に合わせて計算
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight;
      const available =
        vh - MODAL_HEADER_H - DIVIDER_H - SECTION_HEADER_H * 2;
      setRowH(Math.floor(available / (TIME_ROWS.length * 2)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

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
      const rowEnd = rowMin + 60; // 1時間ブロック
      const s = toMin(r.startTime);
      const e = toMin(r.endTime);
      // この1時間ブロックに予約が重なる場合
      if (s < rowEnd && e > rowMin) {
        // 前の行でも表示されていなければ isFirst = true
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

      {/* モーダル：フルスクリーン・スクロールなし */}
      <div
        className="fixed inset-0 z-50 bg-white no-print flex flex-col"
        style={{ overflow: "hidden" }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-4 border-b border-gray-200 bg-white flex-shrink-0"
          style={{ height: MODAL_HEADER_H }}
        >
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
              className="flex items-center gap-1 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-900"
            >
              <Printer size={14} /> 印刷
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* テーブルエリア：スクロールなし */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">読み込み中...</div>
        ) : (
          <div
            className="flex-1 overflow-hidden px-3 py-2"
            style={{ minHeight: 0 }}
          >
            <BoothTable
              dateLabel={dateLabel}
              reservations={reservations}
              seatMap={seatMap}
              timeRows={TIME_ROWS}
              rowH={rowH}
              sectionHeaderH={SECTION_HEADER_H}
              getAt={getAt}
              onCancel={handleCancel}
            />
          </div>
        )}
      </div>

      {/* 予約追加モーダル */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-[60] no-print" onClick={() => setShowAdd(false)} />
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
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">選択してください</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
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

      {/* 印刷専用（ブース表のみ） */}
      <div className="print-only" style={{ display: "none" }}>
        <BoothTable
          dateLabel={dateLabel}
          reservations={reservations}
          seatMap={seatMap}
          timeRows={TIME_ROWS}
          rowH={0}
          sectionHeaderH={0}
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
  rowH,
  sectionHeaderH,
  getAt,
  onCancel,
  isPrint = false,
}: {
  dateLabel: string;
  reservations: Reservation[];
  seatMap: Map<number, number>;
  timeRows: string[];
  rowH: number;
  sectionHeaderH: number;
  getAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint?: boolean;
}) {
  // 印刷時：各行を mm で指定（A4横 8mmマージン ≈ 281×194mm 利用可能）
  // タイトル 6mm → セクション1 (94mm - セクションヘッダー 8mm = 86mm / 25行 ≈ 3.44mm/行)
  // セクション2も同様
  // 13行×2段: (194mm - 16mm余白 - 6mm タイトル - 8mm ヘッダー×2) / 26行 ≈ 6.3mm
  const printRowMm = 6.0;
  const printSecHeaderMm = 8;
  const printTitleMm = 6;

  const outerBorder = "3px solid #1f2937";
  const sectionDivider = "3px solid #1f2937";

  return (
    <div
      style={
        isPrint
          ? {
              width: "281mm",
              fontFamily: "system-ui, sans-serif",
            }
          : {
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }
      }
    >
      {/* タイトル */}
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

      {/* 外枠（太線）で2段を囲む */}
      <div
        style={
          isPrint
            ? { border: outerBorder, flex: 1 }
            : { border: outerBorder, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
        }
      >
        {/* 上段: 1〜6番 */}
        <SectionTable
          seats={SEATS_TOP}
          timeRows={timeRows}
          rowH={rowH}
          sectionHeaderH={sectionHeaderH}
          getAt={getAt}
          onCancel={onCancel}
          isPrint={isPrint}
          printRowMm={printRowMm}
          printSecHeaderMm={printSecHeaderMm}
        />

        {/* 段区切り太線 */}
        <div style={{ borderTop: sectionDivider, flexShrink: 0 }} />

        {/* 下段: 7〜11番 */}
        <SectionTable
          seats={SEATS_BOT}
          timeRows={timeRows}
          rowH={rowH}
          sectionHeaderH={sectionHeaderH}
          getAt={getAt}
          onCancel={onCancel}
          isPrint={isPrint}
          printRowMm={printRowMm}
          printSecHeaderMm={printSecHeaderMm}
        />
      </div>
    </div>
  );
}

// ─── 1段分のテーブル ──────────────────────────────────────────────
function SectionTable({
  seats,
  timeRows,
  rowH,
  sectionHeaderH,
  getAt,
  onCancel,
  isPrint,
  printRowMm,
  printSecHeaderMm,
}: {
  seats: number[];
  timeRows: string[];
  rowH: number;
  sectionHeaderH: number;
  getAt: (seat: number, time: string) => { r: Reservation; isFirst: boolean } | null;
  onCancel: (id: number) => void;
  isPrint: boolean;
  printRowMm: number;
  printSecHeaderMm: number;
}) {
  const headerRowH = isPrint ? `${printSecHeaderMm / 2}mm` : `${Math.floor(sectionHeaderH / 2)}px`;
  const dataRowH = isPrint ? `${printRowMm}mm` : `${rowH}px`;
  const fontSize = isPrint ? 8 : Math.max(9, Math.min(11, rowH - 4));

  return (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        tableLayout: "fixed",
        fontSize,
        ...(isPrint ? {} : { flex: 1 }),
      }}
    >
      <colgroup>
        <col style={{ width: isPrint ? "9mm" : 50 }} />
        {seats.map((s) => (
          <React.Fragment key={s}>
            <col style={{ width: isPrint ? "4mm" : 22 }} />
            <col style={{ width: isPrint ? "6mm" : 30 }} />
            <col />
          </React.Fragment>
        ))}
      </colgroup>

      <thead>
        <tr style={{ height: headerRowH, backgroundColor: "#f3f4f6" }}>
          <th
            rowSpan={2}
            style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 600, color: "#4b5563", verticalAlign: "middle" }}
          >
            時間
          </th>
          {seats.map((s) => (
            <th
              key={s}
              colSpan={3}
              style={{ border: "1px solid #d1d5db", textAlign: "center", fontWeight: 700, color: "#1f2937" }}
            >
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
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: "white" }} />
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: "white" }} />
                    <td style={{ border: "1px solid #f3f4f6", backgroundColor: "white" }} />
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
                  <td
                    style={{ border: "1px solid #f3f4f6", backgroundColor: bg, color: r.customer.course.color, fontWeight: 600, overflow: "hidden", paddingLeft: 2 }}
                    className="group relative"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer.name}</span>
                      {!isPrint && r.id > 0 && (
                        <button
                          onClick={() => onCancel(r.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0"
                          style={{ fontSize: 10, marginLeft: 2 }}
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
