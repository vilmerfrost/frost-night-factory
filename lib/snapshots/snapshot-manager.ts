// =============================================================================
// SNAPSHOT MANAGER - Code snapshots for rollback
// =============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('⚠️ Supabase not available - snapshots will use local storage');
    return null;
  }
  
  return createClient(url, key);
}

const supabase = getSupabaseClient();

interface CodeSnapshot {
  id: string;
  pipeline_id: string;
  phase: string;
  files: Record<string, string>; // path -> content
  created_at: string;
  status: 'valid' | 'broken';
}

export class SnapshotManager {
  private localSnapshots: Map<string, CodeSnapshot> = new Map();
  
  /**
   * Take snapshot before risky operations
   */
  async takeSnapshot(
    pipelineId: string,
    phase: string,
    workspaceFiles: Record<string, string>
  ): Promise<string> {
    const snapshot: CodeSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pipeline_id: pipelineId,
      phase,
      files: workspaceFiles,
      created_at: new Date().toISOString(),
      status: 'valid',
    };
    
    // Store locally
    this.localSnapshots.set(snapshot.id, snapshot);
    
    // Store in Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('code_snapshots')
          .insert({
            id: snapshot.id,
            pipeline_id: pipelineId,
            phase,
            files: workspaceFiles,
            status: 'valid',
            created_at: snapshot.created_at,
          })
          .select()
          .single();
        
        if (error) {
          console.warn(`⚠️ Failed to store snapshot in DB: ${error.message}`);
        } else {
          console.log(`📸 Snapshot created: ${snapshot.id} (stored in DB)`);
          return snapshot.id;
        }
      } catch (err: any) {
        console.warn(`⚠️ Snapshot DB storage failed: ${err.message}`);
      }
    }
    
    console.log(`📸 Snapshot created: ${snapshot.id} (local only)`);
    return snapshot.id;
  }
  
  /**
   * Rollback to last valid snapshot
   */
  async rollback(pipelineId: string, workspaceRoot: string): Promise<boolean> {
    let snapshot: CodeSnapshot | null = null;
    
    // Try Supabase first
    if (supabase) {
      try {
        const { data } = await supabase
          .from('code_snapshots')
          .select('*')
          .eq('pipeline_id', pipelineId)
          .eq('status', 'valid')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data) {
          snapshot = data as CodeSnapshot;
        }
      } catch (err) {
        // Fall back to local
      }
    }
    
    // Fall back to local snapshots
    if (!snapshot) {
      const localSnapshots = Array.from(this.localSnapshots.values())
        .filter(s => s.pipeline_id === pipelineId && s.status === 'valid')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (localSnapshots.length > 0) {
        snapshot = localSnapshots[0] ?? null;
      }
    }
    
    if (!snapshot) {
      console.error(`❌ No valid snapshot found for rollback: ${pipelineId}`);
      return false;
    }
    
    // Restore files
    let restoredCount = 0;
    for (const [filePath, content] of Object.entries(snapshot.files)) {
      try {
        const fullPath = path.join(workspaceRoot, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        restoredCount++;
      } catch (err: any) {
        console.warn(`⚠️ Failed to restore ${filePath}: ${err.message}`);
      }
    }
    
    console.log(`⏪ Rolled back to snapshot: ${snapshot.id} (${restoredCount} files restored)`);
    return true;
  }
  
  /**
   * Mark current snapshot as broken
   */
  async markCurrentAsBroken(pipelineId: string): Promise<void> {
    // Update local
    const localSnapshots = Array.from(this.localSnapshots.values())
      .filter(s => s.pipeline_id === pipelineId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const firstSnapshot = localSnapshots[0];
    if (firstSnapshot) {
      firstSnapshot.status = 'broken';
    }
    
    // Update Supabase
    if (supabase) {
      try {
        await supabase
          .from('code_snapshots')
          .update({ status: 'broken' })
          .eq('pipeline_id', pipelineId)
          .order('created_at', { ascending: false })
          .limit(1);
      } catch (err) {
        // Non-critical
      }
    }
  }
  
  /**
   * Get snapshot by ID
   */
  getSnapshot(id: string): CodeSnapshot | undefined {
    return this.localSnapshots.get(id);
  }
  
  /**
   * List snapshots for a pipeline
   */
  listSnapshots(pipelineId: string): CodeSnapshot[] {
    return Array.from(this.localSnapshots.values())
      .filter(s => s.pipeline_id === pipelineId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  /**
   * Clear old snapshots (keep last N)
   */
  async cleanup(pipelineId: string, keepLast: number = 5): Promise<void> {
    const snapshots = this.listSnapshots(pipelineId);
    
    if (snapshots.length > keepLast) {
      const toDelete = snapshots.slice(keepLast);
      
      for (const snap of toDelete) {
        this.localSnapshots.delete(snap.id);
        
        if (supabase) {
          try {
            await supabase.from('code_snapshots').delete().eq('id', snap.id);
          } catch (err) {
            // Non-critical
          }
        }
      }
      
      console.log(`🧹 Cleaned up ${toDelete.length} old snapshots`);
    }
  }
}

export const snapshots = new SnapshotManager();

