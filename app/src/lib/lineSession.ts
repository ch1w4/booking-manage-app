type SessionState =
  | { step: "idle" }
  | { step: "register_waiting_code" }
  | { step: "reserve_select_date" }
  | { step: "reserve_select_start"; date: string }
  | { step: "reserve_select_end"; date: string; startTime: string }
  | { step: "reserve_confirm"; date: string; startTime: string; endTime: string }
  | { step: "cancel_select"; reservationIds: number[] }
  | { step: "change_select"; reservationIds: number[] }
  | { step: "change_select_date"; reservationId: number }
  | { step: "change_select_start"; reservationId: number; date: string }
  | { step: "change_select_end"; reservationId: number; date: string; startTime: string };

const sessions = new Map<string, SessionState>();

export function getSession(userId: string): SessionState {
  return sessions.get(userId) ?? { step: "idle" };
}

export function setSession(userId: string, state: SessionState): void {
  sessions.set(userId, state);
}

export function clearSession(userId: string): void {
  sessions.set(userId, { step: "idle" });
}
