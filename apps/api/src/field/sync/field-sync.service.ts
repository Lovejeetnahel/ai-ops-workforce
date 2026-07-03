import { Injectable } from '@nestjs/common';
import { TimeService } from '../time/time.service';
import { ExecutionService } from '../execution/execution.service';
import { MovementService } from '../movement/movement.service';
import { AssetsService } from '../assets/assets.service';

export interface SyncAction {
  clientId: string;
  type: string;
  payload: any;
}

/**
 * Offline synchronization. A mobile client queues actions while offline and
 * replays them here in one batch. Each action is routed to the SAME service the
 * online path uses (no duplicate write logic); results are returned per
 * `clientId` so the client can reconcile. Time-clock opens are idempotent, so
 * replays are safe.
 */
@Injectable()
export class FieldSyncService {
  constructor(
    private readonly time: TimeService,
    private readonly execution: ExecutionService,
    private readonly movement: MovementService,
    private readonly assets: AssetsService,
  ) {}

  async sync(userId: string, actions: SyncAction[]) {
    const results: { clientId: string; ok: boolean; result?: unknown; error?: string }[] = [];
    for (const action of actions) {
      try {
        const result = await this.dispatch(userId, action);
        results.push({ clientId: action.clientId, ok: true, result });
      } catch (err) {
        results.push({ clientId: action.clientId, ok: false, error: (err as Error).message });
      }
    }
    return { synced: results.filter((r) => r.ok).length, total: actions.length, results };
  }

  private dispatch(userId: string, action: SyncAction): Promise<unknown> {
    const p = action.payload ?? {};
    switch (action.type) {
      case 'time.clock_in':
        return this.time.clockIn(userId);
      case 'time.clock_out':
        return this.time.clockOut(userId);
      case 'time.break_start':
        return this.time.startBreak(userId);
      case 'time.break_end':
        return this.time.endBreak(userId);
      case 'time.job_start':
        return this.time.startJob(userId, p.jobId);
      case 'time.job_stop':
        return this.time.stopJob(userId, p.jobId);
      case 'time.travel_start':
        return this.time.startTravel(userId, p.jobId);
      case 'time.travel_stop':
        return this.time.stopTravel(userId, p.miles);
      case 'attachment':
        return this.execution.addAttachment(userId, p);
      case 'form':
        return this.execution.submitForm(userId, p);
      case 'location':
        return this.movement.ping(userId, p.lat, p.lng, p.jobId);
      case 'material':
        return this.assets.recordMaterial(p.jobId, p);
      default:
        return Promise.reject(new Error(`Unknown sync action: ${action.type}`));
    }
  }
}
