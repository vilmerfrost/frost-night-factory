'use client';

import { useEffect, useState } from 'react';

export default function CostDashboard() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    fetch('/api/stats/costs')
      .then(res => res.json())
      .then(setData);
  }, []);
  
  if (!data) return <div className="p-8">Loading...</div>;
  
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-4xl font-bold text-white">Cost Analytics</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 text-sm font-mono">TOTAL SPENT</div>
          <div className="text-3xl font-bold text-white mt-2">
            ${data.stats.totalSpent.toFixed(2)}
          </div>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-lg border border-purple-500/30">
          <div className="text-purple-400 text-sm font-mono">AVG PER PIPELINE</div>
          <div className="text-3xl font-bold text-white mt-2">
            ${data.stats.averageCostPerPipeline.toFixed(4)}
          </div>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-lg border border-pink-500/30">
          <div className="text-pink-400 text-sm font-mono">TOTAL PIPELINES</div>
          <div className="text-3xl font-bold text-white mt-2">
            {data.stats.totalPipelines}
          </div>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-lg border border-green-500/30">
          <div className="text-green-400 text-sm font-mono">MOST EXPENSIVE</div>
          <div className="text-lg font-bold text-white mt-2">
            {data.stats.mostExpensiveStep}
          </div>
        </div>
      </div>
      
      {/* Recent Pipelines */}
      <div className="bg-slate-900 p-6 rounded-lg border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-6">Recent Pipelines</h2>
        
        <table className="w-full">
          <thead>
            <tr className="text-left text-cyan-400 border-b border-slate-700">
              <th className="pb-3 font-mono">TIMESTAMP</th>
              <th className="pb-3 font-mono">PIPELINE ID</th>
              <th className="pb-3 font-mono">TOTAL COST</th>
              <th className="pb-3 font-mono">STEPS</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {data.recent.map((pipeline: any) => (
              <tr key={pipeline.pipelineId} className="border-b border-slate-800">
                <td className="py-3 font-mono text-sm">
                  {new Date(pipeline.timestamp).toLocaleString()}
                </td>
                <td className="py-3 font-mono text-xs">
                  {pipeline.pipelineId.slice(0, 8)}
                </td>
                <td className="py-3 text-green-400 font-bold">
                  ${pipeline.totalCost.toFixed(4)}
                </td>
                <td className="py-3">
                  {pipeline.breakdown.length} steps
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

