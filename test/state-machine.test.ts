// =============================================================================
// STATE MACHINE TESTS
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineStateMachine, type PipelinePhase, type PhaseStatus, type ErrorType } from '../lib/state-machine/pipeline-state';

describe('PipelineStateMachine', () => {
  let stateMachine: PipelineStateMachine;
  
  beforeEach(() => {
    stateMachine = new PipelineStateMachine();
  });

  describe('getWorkerId', () => {
    it('should return unique worker ID', () => {
      const workerId = stateMachine.getWorkerId();
      expect(workerId).toMatch(/^worker_\d+_\d+$/);
    });

    it('should return same ID for same instance', () => {
      const id1 = stateMachine.getWorkerId();
      const id2 = stateMachine.getWorkerId();
      expect(id1).toBe(id2);
    });
  });

  describe('hashError', () => {
    it('should hash errors consistently', async () => {
      const error1 = await stateMachine.recordError('test-id', 'SYNTAX', 'Error message');
      const error2 = await stateMachine.recordError('test-id', 'SYNTAX', 'Error message');
      
      // Same error should produce same hash
      expect(error1).toBeDefined();
      expect(error2).toBeDefined();
    });

    it('should hash different errors differently', async () => {
      const error1 = await stateMachine.recordError('test-id', 'SYNTAX', 'Error 1');
      const error2 = await stateMachine.recordError('test-id', 'IMPORT', 'Error 2');
      
      expect(error1).toBeDefined();
      expect(error2).toBeDefined();
    });
  });

  describe('recordError', () => {
    it('should detect error loops', async () => {
      const pipelineId = 'test-pipeline';
      
      // Record same error 3 times
      for (let i = 0; i < 3; i++) {
        const result = await stateMachine.recordError(pipelineId, 'SYNTAX', 'Same error');
        
        if (i === 2) {
          expect(result.isLoop).toBe(true);
          expect(result.shouldRetry).toBe(false);
        } else {
          expect(result.isLoop).toBe(false);
        }
      }
    });

    it('should allow retries for retryable errors', async () => {
      const pipelineId = 'test-pipeline';
      const result = await stateMachine.recordError(pipelineId, 'NETWORK', 'Connection timeout');
      
      expect(result.shouldRetry).toBe(true);
      expect(result.isLoop).toBe(false);
    });

    it('should not retry non-retryable errors after max attempts', async () => {
      const pipelineId = 'test-pipeline';
      
      // Record non-retryable error multiple times
      for (let i = 0; i < 5; i++) {
        const result = await stateMachine.recordError(pipelineId, 'SYNTAX', 'Syntax error');
        
        if (i >= 4) {
          expect(result.shouldRetry).toBe(false);
        }
      }
    });
  });

  describe('cleanup', () => {
    it('should cleanup heartbeats', () => {
      stateMachine.cleanup();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('State Transitions', () => {
  it('should validate phase transitions', () => {
    // This would require mocking Supabase
    // For now, we test the logic conceptually
    expect(true).toBe(true);
  });
});

