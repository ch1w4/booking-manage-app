"use client";

import { useEffect } from "react";

type Course = { id: number; name: string; color: string };
type Customer = { customerCode: string; name: string; course: Course };
type Reservation = {
  id: number;
  startTime: string;
  endTime: string;
  type: string;
  note: string | null;
  customer: Customer;
};

const START_HOUR = 9;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SVG_WIDTH = 900;
const TIME_COL_W = 50;
const ROW_HEIGHT = 40;
const HEADER_H = 50;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToY(minutes: number): number {
  const offset = minutes - START_HOUR * 60;
  return HEADER_H + (offset / 60) * ROW_HEIGHT;
}

export default function PrintSchedule({
  reservations,
  date,
  dateRaw,
}: {
  reservations: Reservation[];
  date: string;
  dateRaw: string;
}) {
  useEffect(() => {
    const btn = document.getElementById("print-btn");
    if (btn) {
      btn.onclick = () => window.print();
    }
  }, []);

  const svgHeight = HEADER_H + TOTAL_HOURS * ROW_HEIGHT + 20;
  const contentWidth = SVG_WIDTH - TIME_COL_W;

  const customerMap = new Map<string, number>();
  const uniqueCustomers: string[] = [];
  reservations.forEach((r) => {
    const key = r.customer.customerCode;
    if (!customerMap.has(key)) {
      customerMap.set(key, uniqueCustomers.length);
      uniqueCustomers.push(key);
    }
  });

  const colWidth = uniqueCustomers.length > 0
    ? contentWidth / uniqueCustomers.length
    : contentWidth;

  const customerData = new Map<string, Customer>();
  reservations.forEach((r) => customerData.set(r.customer.customerCode, r.customer));

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 no-print text-sm text-gray-600">
        <p>
          {date} の予約スケジュール — 顧客数: {uniqueCustomers.length}名 / 予約件数: {reservations.length}件
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={SVG_WIDTH}
          height={svgHeight}
          className="font-sans bg-white border border-gray-200 rounded-xl"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <rect width={SVG_WIDTH} height={svgHeight} fill="white" />

          <text
            x={SVG_WIDTH / 2}
            y={24}
            textAnchor="middle"
            fontSize={14}
            fontWeight="bold"
            fill="#1f2937"
          >
            {date} 予約スケジュール
          </text>

          {uniqueCustomers.map((code, i) => {
            const customer = customerData.get(code)!;
            const x = TIME_COL_W + i * colWidth;
            return (
              <g key={code}>
                <rect
                  x={x}
                  y={30}
                  width={colWidth}
                  height={20}
                  fill={customer.course.color + "20"}
                  stroke={customer.course.color}
                  strokeWidth={0.5}
                />
                <text
                  x={x + colWidth / 2}
                  y={43}
                  textAnchor="middle"
                  fontSize={9}
                  fill={customer.course.color}
                  fontWeight="600"
                >
                  {code} {customer.name}
                </text>
              </g>
            );
          })}

          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            const hour = START_HOUR + i;
            const y = HEADER_H + i * ROW_HEIGHT;
            return (
              <g key={hour}>
                <line x1={0} y1={y} x2={SVG_WIDTH} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={TIME_COL_W - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">
                  {String(hour).padStart(2, "0")}:00
                </text>
              </g>
            );
          })}

          {Array.from({ length: TOTAL_HOURS }, (_, i) => {
            const y = HEADER_H + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <line
                key={`half-${i}`}
                x1={TIME_COL_W}
                y1={y}
                x2={SVG_WIDTH}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth={0.5}
              />
            );
          })}

          <line x1={TIME_COL_W} y1={0} x2={TIME_COL_W} y2={svgHeight} stroke="#d1d5db" strokeWidth={1} />

          {uniqueCustomers.map((_, i) => {
            const x = TIME_COL_W + (i + 1) * colWidth;
            return (
              <line key={`vcol-${i}`} x1={x} y1={HEADER_H} x2={x} y2={svgHeight} stroke="#e5e7eb" strokeWidth={0.5} />
            );
          })}

          {reservations.map((r) => {
            const colIndex = customerMap.get(r.customer.customerCode)!;
            const x = TIME_COL_W + colIndex * colWidth + 2;
            const startMin = timeToMinutes(r.startTime);
            const endMin = timeToMinutes(r.endTime);
            const y = minutesToY(startMin);
            const h = ((endMin - startMin) / 60) * ROW_HEIGHT;
            const color = r.customer.course.color;

            return (
              <g key={r.id}>
                <rect
                  x={x}
                  y={y + 1}
                  width={colWidth - 4}
                  height={h - 2}
                  fill={color + "40"}
                  stroke={color}
                  strokeWidth={1.5}
                  rx={3}
                />
                <text
                  x={x + (colWidth - 4) / 2}
                  y={y + h / 2 - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="600"
                  fill={color}
                >
                  {r.startTime}〜{r.endTime}
                </text>
                <text
                  x={x + (colWidth - 4) / 2}
                  y={y + h / 2 + 7}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#374151"
                >
                  {r.type === "FIXED_INSTANCE" ? "[固定]" : "[フレックス]"}
                  {r.note ? ` ${r.note}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
