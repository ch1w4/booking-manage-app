import { NextRequest, NextResponse } from "next/server";
import { validateLineSignature, lineClient } from "@/lib/line";
import { prisma } from "@/lib/db";
import { getSession, setSession, clearSession } from "@/lib/lineSession";
import { format, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import type { Message, FlexMessage, TextMessage } from "@line/bot-sdk";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function timeText(t: string) {
  return t;
}

function dateLabel(d: Date) {
  return format(d, "M月d日（EEEEE）", { locale: ja });
}

function makeTimeOptions(from = "09:00", to = "20:30") {
  const times: string[] = [];
  let [h, m] = from.split(":").map(Number);
  const [eh, em] = to.split(":").map(Number);
  while (h < eh || (h === eh && m <= em)) {
    times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) { h++; m = 0; }
  }
  return times;
}

function quickReplyItems(items: { label: string; text: string }[]) {
  return items.map((it) => ({
    type: "action" as const,
    action: { type: "message" as const, label: it.label, text: it.text },
  }));
}

function textMsg(text: string, quickReplies?: { label: string; text: string }[]): TextMessage {
  return {
    type: "text",
    text,
    ...(quickReplies && {
      quickReply: { items: quickReplyItems(quickReplies) },
    }),
  };
}

function reservationCard(r: {
  id: number;
  date: string | Date;
  startTime: string;
  endTime: string;
  type: string;
  customer: { name: string; customerCode: string };
}): FlexMessage {
  const dateStr = typeof r.date === "string"
    ? r.date.slice(0, 10)
    : format(r.date, "yyyy-MM-dd");
  const dateLabel = format(parseISO(dateStr), "M月d日（EEEEE）", { locale: ja });

  return {
    type: "flex",
    altText: `予約: ${dateLabel} ${r.startTime}〜${r.endTime}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "予約確認",
            weight: "bold",
            size: "sm",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#3B82F6",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "日付", size: "sm", color: "#6b7280", flex: 2 },
              { type: "text", text: dateLabel, size: "sm", weight: "bold", flex: 5 },
            ],
            paddingBottom: "8px",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "時間", size: "sm", color: "#6b7280", flex: 2 },
              {
                type: "text",
                text: `${r.startTime} 〜 ${r.endTime}`,
                size: "sm",
                weight: "bold",
                flex: 5,
              },
            ],
            paddingBottom: "8px",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "種別", size: "sm", color: "#6b7280", flex: 2 },
              {
                type: "text",
                text: r.type === "FIXED_INSTANCE" ? "固定" : "フレックス",
                size: "sm",
                flex: 5,
              },
            ],
          },
        ],
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "変更",
              text: `変更:${r.id}`,
            },
            style: "secondary",
            flex: 1,
          },
          { type: "separator" },
          {
            type: "button",
            action: {
              type: "message",
              label: "キャンセル",
              text: `キャンセル:${r.id}`,
            },
            style: "secondary",
            color: "#EF4444",
            flex: 1,
          },
        ],
        paddingAll: "12px",
        spacing: "sm",
      },
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!validateLineSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const payload = JSON.parse(body);
  const events = payload.events ?? [];

  for (const event of events) {
    if (event.type === "follow") {
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          "パソコン教室の公式LINEへようこそ！\n\nご利用には顧客IDの登録が必要です。\n4桁の顧客IDを入力してください。",
          [{ label: "ID登録", text: "登録" }]
        ),
      ]);
      setSession(event.source.userId, { step: "register_waiting_code" });
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const userId: string = event.source.userId;
    const text: string = event.message.text.trim();
    const session = getSession(userId);

    const customer = await prisma.customer.findUnique({
      where: { lineUserId: userId },
    });

    if (!customer && session.step !== "register_waiting_code") {
      await lineClient.replyMessage(event.replyToken, [
        textMsg("まず顧客IDを登録してください。4桁のIDを入力してください。"),
      ]);
      setSession(userId, { step: "register_waiting_code" });
      continue;
    }

    if (text === "登録" || session.step === "register_waiting_code") {
      if (text === "登録" && session.step !== "register_waiting_code") {
        setSession(userId, { step: "register_waiting_code" });
        await lineClient.replyMessage(event.replyToken, [
          textMsg("4桁の顧客IDを入力してください。"),
        ]);
        continue;
      }

      if (/^\d{4}$/.test(text)) {
        const found = await prisma.customer.findUnique({
          where: { customerCode: text },
        });
        if (!found) {
          await lineClient.replyMessage(event.replyToken, [
            textMsg("そのIDは見つかりませんでした。もう一度入力してください。"),
          ]);
          continue;
        }
        await prisma.customer.update({
          where: { id: found.id },
          data: { lineUserId: userId },
        });
        clearSession(userId);
        await lineClient.replyMessage(event.replyToken, [
          textMsg(
            `${found.name} さん、登録完了しました！\n\n以下のメニューからご利用ください。`,
            [
              { label: "予約する", text: "予約する" },
              { label: "予約確認・変更", text: "予約確認" },
              { label: "キャンセル", text: "キャンセル" },
            ]
          ),
        ]);
        continue;
      }

      await lineClient.replyMessage(event.replyToken, [
        textMsg("4桁の数字で入力してください。"),
      ]);
      continue;
    }

    if (text === "予約する" || text === "予約") {
      setSession(userId, { step: "reserve_select_date" });
      const today = new Date();
      const quickReplies = [
        { label: "今日", text: format(today, "yyyy-MM-dd") },
        { label: "明日", text: format(addDays(today, 1), "yyyy-MM-dd") },
        ...Array.from({ length: 5 }, (_, i) => {
          const d = addDays(today, i + 2);
          return { label: dateLabel(d), text: format(d, "yyyy-MM-dd") };
        }),
      ];
      await lineClient.replyMessage(event.replyToken, [
        textMsg("ご希望の日付を選んでください。", quickReplies),
      ]);
      continue;
    }

    if (session.step === "reserve_select_date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      setSession(userId, { step: "reserve_select_start", date: text });
      const times = makeTimeOptions("09:00", "19:30");
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `${format(parseISO(text), "M月d日（EEEEE）", { locale: ja })}\n開始時間を選んでください。`,
          times.map((t) => ({ label: t, text: t }))
        ),
      ]);
      continue;
    }

    if (session.step === "reserve_select_start" && /^\d{2}:\d{2}$/.test(text)) {
      setSession(userId, {
        step: "reserve_select_end",
        date: session.date,
        startTime: text,
      });
      const [h, m] = text.split(":").map(Number);
      const startMin = h * 60 + m;
      const times = makeTimeOptions(text, "21:00").filter((t) => {
        const [th, tm] = t.split(":").map(Number);
        return th * 60 + tm > startMin;
      });
      await lineClient.replyMessage(event.replyToken, [
        textMsg(`終了時間を選んでください。`, times.map((t) => ({ label: t, text: t }))),
      ]);
      continue;
    }

    if (session.step === "reserve_select_end" && /^\d{2}:\d{2}$/.test(text)) {
      setSession(userId, {
        step: "reserve_confirm",
        date: session.date,
        startTime: session.startTime,
        endTime: text,
      });
      const dateStr = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `以下の内容で予約しますか？\n\n日付: ${dateStr}\n時間: ${session.startTime} 〜 ${text}`,
          [
            { label: "確定する", text: "確定" },
            { label: "やり直す", text: "予約する" },
          ]
        ),
      ]);
      continue;
    }

    if (session.step === "reserve_confirm" && text === "確定") {
      await prisma.reservation.create({
        data: {
          customerId: customer!.id,
          date: parseISO(session.date),
          startTime: session.startTime,
          endTime: session.endTime,
          type: "FLEX",
        },
      });
      clearSession(userId);
      const dateStr = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `予約が完了しました！\n\n日付: ${dateStr}\n時間: ${session.startTime} 〜 ${session.endTime}`,
          [
            { label: "予約確認", text: "予約確認" },
            { label: "メニューへ", text: "メニュー" },
          ]
        ),
      ]);
      continue;
    }

    if (text === "予約確認" || text === "予約確認・変更") {
      const reservations = await prisma.reservation.findMany({
        where: {
          customerId: customer!.id,
          status: "CONFIRMED",
          date: { gte: new Date() },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
      });

      if (reservations.length === 0) {
        await lineClient.replyMessage(event.replyToken, [
          textMsg("現在予約はありません。", [
            { label: "予約する", text: "予約する" },
          ]),
        ]);
        continue;
      }

      const messages: Message[] = reservations.map((r) =>
        reservationCard({ ...r, customer: customer! })
      );
      await lineClient.replyMessage(event.replyToken, messages.slice(0, 5));
      continue;
    }

    if (text.startsWith("キャンセル:")) {
      const id = Number(text.split(":")[1]);
      const reservation = await prisma.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.customerId !== customer!.id) {
        await lineClient.replyMessage(event.replyToken, [
          textMsg("予約が見つかりません。"),
        ]);
        continue;
      }
      const dateStr = format(reservation.date, "M月d日（EEEEE）", { locale: ja });
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `${dateStr} ${reservation.startTime}〜${reservation.endTime} の予約をキャンセルしますか？`,
          [
            { label: "キャンセルする", text: `キャンセル確定:${id}` },
            { label: "戻る", text: "予約確認" },
          ]
        ),
      ]);
      continue;
    }

    if (text.startsWith("キャンセル確定:")) {
      const id = Number(text.split(":")[1]);
      await prisma.reservation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      clearSession(userId);
      await lineClient.replyMessage(event.replyToken, [
        textMsg("予約をキャンセルしました。", [
          { label: "予約する", text: "予約する" },
          { label: "メニューへ", text: "メニュー" },
        ]),
      ]);
      continue;
    }

    if (text.startsWith("変更:")) {
      const id = Number(text.split(":")[1]);
      setSession(userId, { step: "change_select_date", reservationId: id });
      const today = new Date();
      const quickReplies = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i);
        return { label: dateLabel(d), text: format(d, "yyyy-MM-dd") };
      });
      await lineClient.replyMessage(event.replyToken, [
        textMsg("新しい日付を選んでください。", quickReplies),
      ]);
      continue;
    }

    if (session.step === "change_select_date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      setSession(userId, {
        step: "change_select_start",
        reservationId: session.reservationId,
        date: text,
      });
      const times = makeTimeOptions("09:00", "19:30");
      await lineClient.replyMessage(event.replyToken, [
        textMsg("新しい開始時間を選んでください。", times.map((t) => ({ label: t, text: t }))),
      ]);
      continue;
    }

    if (session.step === "change_select_start" && /^\d{2}:\d{2}$/.test(text)) {
      setSession(userId, {
        step: "change_select_end",
        reservationId: session.reservationId,
        date: session.date,
        startTime: text,
      });
      const [h, m] = text.split(":").map(Number);
      const startMin = h * 60 + m;
      const times = makeTimeOptions(text, "21:00").filter((t) => {
        const [th, tm] = t.split(":").map(Number);
        return th * 60 + tm > startMin;
      });
      await lineClient.replyMessage(event.replyToken, [
        textMsg("新しい終了時間を選んでください。", times.map((t) => ({ label: t, text: t }))),
      ]);
      continue;
    }

    if (session.step === "change_select_end" && /^\d{2}:\d{2}$/.test(text)) {
      await prisma.reservation.update({
        where: { id: session.reservationId },
        data: {
          date: parseISO(session.date),
          startTime: session.startTime,
          endTime: text,
        },
      });
      clearSession(userId);
      const dateStr = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `予約を変更しました！\n\n日付: ${dateStr}\n時間: ${session.startTime} 〜 ${text}`,
          [
            { label: "予約確認", text: "予約確認" },
            { label: "メニューへ", text: "メニュー" },
          ]
        ),
      ]);
      continue;
    }

    if (text === "キャンセル") {
      const reservations = await prisma.reservation.findMany({
        where: {
          customerId: customer!.id,
          status: "CONFIRMED",
          date: { gte: new Date() },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
      });
      if (reservations.length === 0) {
        await lineClient.replyMessage(event.replyToken, [
          textMsg("現在予約はありません。"),
        ]);
        continue;
      }
      const messages: Message[] = reservations.map((r) =>
        reservationCard({ ...r, customer: customer! })
      );
      await lineClient.replyMessage(event.replyToken, messages.slice(0, 5));
      continue;
    }

    if (text === "メニュー" || text === "ホーム") {
      clearSession(userId);
      await lineClient.replyMessage(event.replyToken, [
        textMsg(
          `${customer!.name} さん、何をしますか？`,
          [
            { label: "予約する", text: "予約する" },
            { label: "予約確認・変更", text: "予約確認" },
            { label: "キャンセル", text: "キャンセル" },
          ]
        ),
      ]);
      continue;
    }

    await lineClient.replyMessage(event.replyToken, [
      textMsg(
        "ご用件をお選びください。",
        [
          { label: "予約する", text: "予約する" },
          { label: "予約確認・変更", text: "予約確認" },
          { label: "キャンセル", text: "キャンセル" },
        ]
      ),
    ]);
  }

  return NextResponse.json({ ok: true });
}
