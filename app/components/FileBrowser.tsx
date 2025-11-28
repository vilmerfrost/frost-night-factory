"use client";

import { useState, useEffect } from "react";
import { RefreshCcw, FileText, Trash2, Download } from "lucide-react";

export default function FileBrowser({ taskId }: { taskId: any }) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Hämta filer från workspace
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_files", dir: "" }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFiles(data);
      }
    } catch (e) {
      console.error("Failed to fetch files", e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Radera fil
  const deleteFile = async (filename: string) => {
    if(!confirm(`Delete ${filename}?`)) return; // Säkerhetskoll
    
    await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_file", path: filename })
    });
    fetchFiles(); 
  };

  // 3. Ladda ner / Exportera MD (Den nya funktionen!)
  const downloadFile = async (filename: string) => {
    try {
        // Hämta innehållet först
        const res = await fetch("/api/agent/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read_file", path: filename })
        });
        const data = await res.json();
        
        if (!data.content) {
            alert("Could not read file content");
            return;
        }

        // Formatera enligt din spec
        const exportContent = `# Frost Night Factory Export\n\n**File:** ${filename}\n\n\`\`\`\n${data.content}\n\`\`\``;

        // Skapa en blob och ladda ner
        const blob = new Blob([exportContent], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`; // Spara som .md
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (e) {
        console.error("Download failed", e);
        alert("Download failed");
    }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 w-full h-full min-h-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-zinc-400 font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" /> Frost File Browser (Local)
        </h3>
        <button 
          onClick={fetchFiles} 
          className={`p-2 hover:bg-zinc-800 rounded transition ${loading ? "animate-spin" : ""}`}
        >
          <RefreshCcw className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      <div className="space-y-2">
        {files.length === 0 ? (
          <div className="text-zinc-600 text-sm text-center py-8">
            No files generated yet
          </div>
        ) : (
          files.map((file) => (
            <div key={file} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800/50 rounded hover:border-zinc-700 transition group">
              <span className="text-zinc-300 text-sm font-mono">{file}</span>
              
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button 
                    onClick={() => deleteFile(file)}
                    className="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded"
                    title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Nu funkar denna! */}
                <button 
                    onClick={() => downloadFile(file)}
                    className="p-1.5 hover:bg-blue-900/30 text-zinc-500 hover:text-blue-400 rounded"
                    title="Export MD"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}