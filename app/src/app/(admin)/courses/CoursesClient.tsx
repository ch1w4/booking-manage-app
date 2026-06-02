"use client";

import { useState } from "react";
import { Plus, X, Edit2 } from "lucide-react";

type Course = {
  id: number;
  name: string;
  idPrefix: number;
  color: string;
  description: string | null;
};

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6B7280",
];

export default function CoursesClient({
  initialCourses,
}: {
  initialCourses: Course[];
}) {
  const [courses, setCourses] = useState(initialCourses);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState({
    name: "",
    idPrefix: "",
    color: "#3B82F6",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setForm({ name: "", idPrefix: "", color: "#3B82F6", description: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Course) {
    setEditing(c);
    setForm({
      name: c.name,
      idPrefix: String(c.idPrefix),
      color: c.color,
      description: c.description ?? "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/courses/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            color: form.color,
            description: form.description || null,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCourses((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
          setShowForm(false);
        } else {
          const d = await res.json();
          setError(d.error ?? "エラーが発生しました");
        }
      } else {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            idPrefix: Number(form.idPrefix),
            color: form.color,
            description: form.description || null,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setCourses((prev) => [...prev, created].sort((a, b) => a.idPrefix - b.idPrefix));
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
    if (!confirm("この講座を削除しますか？")) return;
    const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
    if (res.ok) setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">講座設定</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            IDの先頭数字と講座の対応を管理します
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          講座追加
        </button>
      </div>

      <div className="space-y-3">
        {courses.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ backgroundColor: c.color }}
            >
              {c.idPrefix}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">{c.name}</p>
                <span className="text-xs text-gray-400 font-mono">
                  {c.idPrefix}xxx
                </span>
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 truncate">{c.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEdit(c)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {editing ? "講座を編集" : "講座を追加"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IDプレフィックス（1〜9）
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={form.idPrefix}
                    onChange={(e) => setForm({ ...form, idPrefix: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: 1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    この数字から始まるIDの顧客がこの講座に属します
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">講座名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">カラー</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明（任意）
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                disabled={saving || !form.name || (!editing && !form.idPrefix)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
