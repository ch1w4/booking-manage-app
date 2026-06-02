import { NextRequest, NextResponse } from "next/server";
import { validateLineSignature, getLineClient } from "@/lib/line";
import { prisma } from "@/lib/db";
import { getSession, setSession, clearSession } from "@/lib/lineSession";
import { format, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import type { Message, FlexMessage, TextMessage } from "@line/bot-sdk";

function dateLabelStr(d: Date) {
  return format(d, "M月d日（EEEEE）", { locale: ja });
}

// 開始時刻: 9〜20時の整時のみ（12個 = LINE上限13以内）
function makeStartHours(): { label: string; text: string }[] {
  const items = [];
  for (let h = 9; h <= 20; h++) {
    const t = `${String(h).padStart(2, "0")}:00`;
    items.push({ label: t, text: t });
  }
  return items;
}

// 終了時刻: 開始から+30分〜+4時間（30分刻み、最大8個）
function makeEndTimes(startTime: string): { label: string; text: string }[] {
  const [h, m] = startTime.split(":").map(Number);
  const startMin = h * 60 + m;
  const items = [];
  for (let i = 1; i <= 8; i++) {
    const endMin = startMin + i * 30;
    if (endMin > 21 * 60) break;
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    const t = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    items.push({ label: t, text: t });
  }
  return items;
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
  const dateStr =
    typeof r.date === "string" ? r.date.slice(0, 10) : format(r.date, "yyyy-MM-dd");
  const dl = format(parseISO(dateStr), "M月d日（EEEEE）", { locale: ja });

  return {
    type: "flex",
    altText: `予約: ${dl} ${r.startTime}〜${r.endTime}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: "予約確認", weight: "bold", size: "sm", color: "#ffffff" }],
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
              { type: "text", text: dl, size: "sm", weight: "bold", flex: 5 },
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
            action: { type: "message", label: "変更", text: `変更:${r.id}` },
            style: "secondary",
            flex: 1,
          },
          { type: "separator" },
          {
            type: "button",
            action: { type: "message", label: "キャンセル", text: `キャンセル:${r.id}` },
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

const MENU_REPLIES = [
  { label: "予約する", text: "予約する" },
  { label: "予約確認・変更", text: "予約確認" },
  { label: "キャンセル", text: "キャンセル" },
];

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!validateLineSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const payload = JSON.parse(body);
  const events = payload.events ?? [];

  for (const event of events) {
    // 友だち追加
    if (event.type === "follow") {
      setSession(event.source.userId, { step: "register_waiting_code" });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          "パソコン教室の公式LINEへようこそ！\n\nご利用には顧客IDの登録が必要です。\n4桁の顧客IDを入力してください。"
        ),
      ]);
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const userId: string = event.source.userId;
    const text: string = event.message.text.trim();
    const session = getSession(userId);

    const customer = await prisma.customer.findUnique({ where: { lineUserId: userId } });

    // ── 未登録ユーザー ──────────────────────────────────────
    if (!customer && session.step !== "register_waiting_code") {
      setSession(userId, { step: "register_waiting_code" });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("まず顧客IDを登録してください。4桁のIDを入力してください。"),
      ]);
      continue;
    }

    // ── ID登録フロー ────────────────────────────────────────
    if (text === "登録" && session.step !== "register_waiting_code") {
      setSession(userId, { step: "register_waiting_code" });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("4桁の顧客IDを入力してください。"),
      ]);
      continue;
    }

    if (session.step === "register_waiting_code") {
      if (/^\d{4}$/.test(text)) {
        const found = await prisma.customer.findUnique({ where: { customerCode: text } });
        if (!found) {
          await getLineClient().replyMessage(event.replyToken, [
            textMsg("そのIDは見つかりませんでした。もう一度4桁のIDを入力してください。"),
          ]);
          continue;
        }
        await prisma.customer.update({ where: { id: found.id }, data: { lineUserId: userId } });
        clearSession(userId);
        await getLineClient().replyMessage(event.replyToken, [
          textMsg(`${found.name} さん、登録完了しました！\n何をしますか？`, MENU_REPLIES),
        ]);
        continue;
      }
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("4桁の数字で入力してください。"),
      ]);
      continue;
    }

    // ── 予約フロー ──────────────────────────────────────────
    if (text === "予約する" || text === "予約") {
      setSession(userId, { step: "reserve_select_date" });
      const today = new Date();
      const dateReplies = [
        { label: "今日", text: format(today, "yyyy-MM-dd") },
        { label: "明日", text: format(addDays(today, 1), "yyyy-MM-dd") },
        ...Array.from({ length: 5 }, (_, i) => {
          const d = addDays(today, i + 2);
          return { label: dateLabelStr(d), text: format(d, "yyyy-MM-dd") };
        }),
      ];
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("ご希望の日付を選んでください。", dateReplies),
      ]);
      continue;
    }

    // 日付選択
    if (session.step === "reserve_select_date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      setSession(userId, { step: "reserve_select_start", date: text });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `${format(parseISO(text), "M月d日（EEEEE）", { locale: ja })}\n開始時間を選んでください。`,
          makeStartHours()
        ),
      ]);
      continue;
    }

    // 開始時刻選択
    if (session.step === "reserve_select_start" && /^\d{2}:\d{2}$/.test(text)) {
      setSession(userId, { step: "reserve_select_end", date: session.date, startTime: text });
      const endOptions = makeEndTimes(text);
      if (endOptions.length === 0) {
        // 20:00開始など終了時刻が取れない場合は戻す
        setSession(userId, { step: "reserve_select_start", date: session.date });
        await getLineClient().replyMessage(event.replyToken, [
          textMsg("その時間は選べません。別の開始時間を選んでください。", makeStartHours()),
        ]);
        continue;
      }
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(`開始: ${text}\n終了時間を選んでください。`, endOptions),
      ]);
      continue;
    }

    // 終了時刻選択
    if (session.step === "reserve_select_end" && /^\d{2}:\d{2}$/.test(text)) {
      setSession(userId, {
        step: "reserve_confirm",
        date: session.date,
        startTime: session.startTime,
        endTime: text,
      });
      const dl = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `以下の内容で予約しますか？\n\n📅 ${dl}\n🕐 ${session.startTime} 〜 ${text}`,
          [
            { label: "確定する", text: "確定" },
            { label: "やり直す", text: "予約する" },
          ]
        ),
      ]);
      continue;
    }

    // 予約確定
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
      const dl = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `✅ 予約が完了しました！\n\n📅 ${dl}\n🕐 ${session.startTime} 〜 ${session.endTime}`,
          MENU_REPLIES
        ),
      ]);
      continue;
    }

    // ── 予約確認・変更 ──────────────────────────────────────
    if (text === "予約確認" || text === "予約確認・変更") {
      const reservations = await prisma.reservation.findMany({
        where: { customerId: customer!.id, status: "CONFIRMED", date: { gte: new Date() } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
      });
      if (reservations.length === 0) {
        await getLineClient().replyMessage(event.replyToken, [
          textMsg("現在予約はありません。", [{ label: "予約する", text: "予約する" }]),
        ]);
        continue;
      }
      const messages: Message[] = reservations.map((r) =>
        reservationCard({ ...r, customer: customer! })
      );
      await getLineClient().replyMessage(event.replyToken, messages.slice(0, 5));
      continue;
    }

    // ── キャンセルフロー ────────────────────────────────────
    if (text === "キャンセル") {
      const reservations = await prisma.reservation.findMany({
        where: { customerId: customer!.id, status: "CONFIRMED", date: { gte: new Date() } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
      });
      if (reservations.length === 0) {
        await getLineClient().replyMessage(event.replyToken, [
          textMsg("現在予約はありません。", MENU_REPLIES),
        ]);
        continue;
      }
      const messages: Message[] = reservations.map((r) =>
        reservationCard({ ...r, customer: customer! })
      );
      await getLineClient().replyMessage(event.replyToken, messages.slice(0, 5));
      continue;
    }

    if (text.startsWith("キャンセル:")) {
      const id = Number(text.split(":")[1]);
      const reservation = await prisma.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.customerId !== customer!.id) {
        await getLineClient().replyMessage(event.replyToken, [textMsg("予約が見つかりません。")]);
        continue;
      }
      const dl = format(reservation.date, "M月d日（EEEEE）", { locale: ja });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `${dl} ${reservation.startTime}〜${reservation.endTime} の予約をキャンセルしますか？`,
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
      await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED" } });
      clearSession(userId);
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("予約をキャンセルしました。", MENU_REPLIES),
      ]);
      continue;
    }

    // ── 変更フロー ──────────────────────────────────────────
    if (text.startsWith("変更:")) {
      const id = Number(text.split(":")[1]);
      setSession(userId, { step: "change_select_date", reservationId: id });
      const today = new Date();
      const dateReplies = [
        { label: "今日", text: format(today, "yyyy-MM-dd") },
        { label: "明日", text: format(addDays(today, 1), "yyyy-MM-dd") },
        ...Array.from({ length: 5 }, (_, i) => {
          const d = addDays(today, i + 2);
          return { label: dateLabelStr(d), text: format(d, "yyyy-MM-dd") };
        }),
      ];
      await getLineClient().replyMessage(event.replyToken, [
        textMsg("新しい日付を選んでください。", dateReplies),
      ]);
      continue;
    }

    if (session.step === "change_select_date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      setSession(userId, {
        step: "change_select_start",
        reservationId: session.reservationId,
        date: text,
      });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `${format(parseISO(text), "M月d日（EEEEE）", { locale: ja })}\n新しい開始時間を選んでください。`,
          makeStartHours()
        ),
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
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(`開始: ${text}\n新しい終了時間を選んでください。`, makeEndTimes(text)),
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
      const dl = format(parseISO(session.date), "M月d日（EEEEE）", { locale: ja });
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(
          `✅ 予約を変更しました！\n\n📅 ${dl}\n🕐 ${session.startTime} 〜 ${text}`,
          MENU_REPLIES
        ),
      ]);
      continue;
    }

    // ── メニュー ────────────────────────────────────────────
    if (text === "メニュー" || text === "ホーム") {
      clearSession(userId);
      await getLineClient().replyMessage(event.replyToken, [
        textMsg(`${customer!.name} さん、何をしますか？`, MENU_REPLIES),
      ]);
      continue;
    }

    // その他
    await getLineClient().replyMessage(event.replyToken, [
      textMsg("ご用件をお選びください。", MENU_REPLIES),
    ]);
  }

  return NextResponse.json({ ok: true });
}
