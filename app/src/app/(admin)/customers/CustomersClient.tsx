"use client";

import { useState } from "react";
import { Plus, Search, X, Edit2, Repeat } from "lucide-react";
import RecurringModal from "./RecurringModal";

type Course = { id: number; name: string; idPrefix: number; color: string };
type Customer = {
  id: number;
  customerCode: string;
  name: string;
  lineUserId: string | null;
  course: Course;
  courseId: number;
};

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function CustomersClient({
  initialCustomers,
  courses,
}: {
  initialCustomers: Customer[];
  courses: Course[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [recurringCustomer, setRecurringCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ customerCode: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.includes(query) ||
      c.customerCode.includes(query) ||
      c.course.name.includes(query)
  );

  function openNew() {
    setEditing(null);
    setForm({ customerCode: "", name: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ customerCode: c.customerCode, name: c.name });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/customers/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCustomers((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
          setShowForm(false);
        } else {
          const d = await res.json();
          setError(d.error ?? "エラーが発生しました");
        }
      } else {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerCode: form.customerCode, name: form.name }),
        });
        if (res.ok) {
          const created = await res.json();
          setCustomers((prev) => [...prev, created].sort((a, b) => a.customerCode.localeCompare(b.customerCode)));
          setShowForm(false);
        } else {
          const d = await res.json();
          setError(d.error ?? "エラーが発生しました");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("この顧客を削除しますか？関連する予約データも削除されます。")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">顧客管理</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          顧客追加
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・ID・講座で検索"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">講座</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">LINE</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  顧客が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-800">
                    {c.customerCode}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: c.course.color }}
                    >
                      {c.course.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.lineUserId ? (
                      <span className="text-xs text-green-600 font-medium">連携済</span>
                    ) : (
                      <span className="text-xs text-gray-400">未連携</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRecurringCustomer(c)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title="固定予約"
                      >
                        <Repeat size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title="編集"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                        title="削除"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {editing ? "顧客を編集" : "顧客を追加"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顧客ID（4桁）
                  </label>
                  <input
                    type="text"
                    value={form.customerCode}
                    onChange={(e) => setForm({ ...form, customerCode: e.target.value })}
                    placeholder="例: 1001"
                    maxLength={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    先頭の数字が講座を決定します（1=MOS, 5=子どもIT, 8=子ども本格）
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

            <div className="flex gap-2 mt-6">
              <div className="flex-1" />
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || (!editing && !form.customerCode)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {recurringCustomer && (
        <RecurringModal
          customer={recurringCustomer}
          onClose={() => setRecurringCustomer(null)}
        />
      )}
    </div>
  );
}
