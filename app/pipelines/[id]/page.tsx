"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Download, Code } from "lucide-react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function PipelineDetailPage() {
  const params = useParams();
  const [pipeline, setPipeline] = useState<any>(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const [pipelineRes, stepsRes] = await Promise.all([
          supabaseBrowser.from('pipelines').select('*').eq('id', params.id).single(),
          supabaseBrowser.from('pipeline_steps').select('*').eq('pipeline_id', params.id).order('created_at', { ascending: true })
        ]);

        if (pipelineRes.data) setPipeline(pipelineRes.data);
        if (stepsRes.data) setSteps(stepsRes.data);
      } catch (error) {
        console.error('Failed to fetch pipeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();

    // Real-time updates
    const channel = supabaseBrowser
      .channel(`pipeline-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipelines",
          filter: `id=eq.${params.id}`,
        },
        () => {
          fetchPipeline();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_steps",
          filter: `pipeline_id=eq.${params.id}`,
        },
        () => {
          fetchPipeline();
        }
      )
      .subscribe();

    // Refresh every 3 seconds
    const interval = setInterval(fetchPipeline, 3000);
    return () => {
      clearInterval(interval);
      supabaseBrowser.removeChannel(channel);
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Pipeline Not Found</h2>
        <Link href="/pipelines">
          <button className="text-blue-600 hover:text-blue-700">
            ← Back to Pipelines
          </button>
        </Link>
      </div>
    );
  }

  const phaseIcons: any = {
    research: '🔍',
    planner: '📋',
    coder: '💻',
    sql: '🗄️',
    tester: '🧪',
    publisher: '🚀',
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="px-8 py-4">
          <Link href="/pipelines">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Pipelines
            </button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {pipeline.name || 'Untitled Pipeline'}
              </h1>
              <p className="text-sm text-gray-600">
                {pipeline.initial_prompt || 'No description'}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                <Code className="w-4 h-4" />
                View Code
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Pipeline Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-6">Pipeline Progress</h2>
          
          <div className="space-y-4">
            {steps.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No steps yet</p>
            ) : (
              steps.map((step: any, index: number) => {
                const isActive = step.status === 'running';
                const isCompleted = step.status === 'completed';
                const isFailed = step.status === 'failed';
                
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100 animate-pulse' : isFailed ? 'bg-red-100' : 'bg-gray-100'}
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : isActive ? (
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      ) : isFailed ? (
                        <XCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {phaseIcons[step.name] || '⚡'} {step.name || step.phase}
                        </h3>
                        <span className={`
                          px-3 py-1 rounded-full text-xs font-semibold
                          ${isCompleted ? 'bg-green-100 text-green-700' : 
                            isActive ? 'bg-blue-100 text-blue-700' : 
                            isFailed ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-600'}
                        `}>
                          {step.status}
                        </span>
                      </div>
                      
                      {step.logs && (
                        <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto">
                          {typeof step.logs === 'string' ? step.logs.substring(0, 200) : JSON.stringify(step.logs).substring(0, 200)}...
                        </pre>
                      )}
                      
                      {step.created_at && (
                        <p className="text-xs text-gray-500 mt-2">
                          Started: {new Date(step.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <div className="text-lg font-semibold text-gray-900 capitalize">{pipeline.status}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Current Phase</div>
            <div className="text-lg font-semibold text-gray-900 capitalize">{pipeline.current_phase || 'research'}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Created</div>
            <div className="text-lg font-semibold text-gray-900">
              {new Date(pipeline.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

