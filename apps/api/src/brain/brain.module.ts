import { Global, Module } from '@nestjs/common';
import { VectorStore } from './vector-store.service';
import { KnowledgeService } from './knowledge.service';
import { MemoryService } from './memory.service';
import { BusinessBrainService } from './business-brain.service';
import { BrainContextService } from './brain-context.service';
import { BrainController } from './brain.controller';

/**
 * The Business Brain — the V2 core intelligence layer. Global so every agent and
 * surface can inject BusinessBrainService / BrainContextService without coupling.
 * Depends only on globals (Prisma, Integrations), so it introduces no cycles.
 */
@Global()
@Module({
  controllers: [BrainController],
  providers: [VectorStore, KnowledgeService, MemoryService, BusinessBrainService, BrainContextService],
  exports: [BusinessBrainService, BrainContextService],
})
export class BrainModule {}
