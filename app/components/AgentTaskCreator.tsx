"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

interface AgentTaskCreatorProps {
  onTaskCreated?: () => void;
}

export default function AgentTaskCreator({ onTaskCreated }: AgentTaskCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    repoUrl: "git@github.com:vilmerfrost/frost-night-factory.git",
    branch: "main",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/agent/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          repoUrl: formData.repoUrl,
          branch: formData.branch,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task");
      }

      const data = await res.json();
      console.log("✅ Task created:", data.task);

      // Reset form
      setFormData({
        title: "",
        description: "",
        repoUrl: "git@github.com:vilmerfrost/frost-night-factory.git",
        branch: "main",
      });
      setIsOpen(false);

      if (onTaskCreated) {
        onTaskCreated();
      }
    } catch (error: any) {
      console.error("❌ Error creating task:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition"
      >
        <Plus className="w-4 h-4" />
        New Agent Task
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Create Agent Task</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="e.g., Fix payroll export crash"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 font-mono text-sm"
              placeholder="Steps to reproduce:&#10;1. Click on export&#10;2. Select payroll&#10;3. App crashes..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Repository URL
            </label>
            <input
              type="text"
              required
              value={formData.repoUrl}
              onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 font-mono text-sm"
              placeholder="git@github.com:user/repo.git"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Branch
            </label>
            <input
              type="text"
              required
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="main"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

