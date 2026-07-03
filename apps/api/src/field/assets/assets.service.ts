import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Equipment/asset tracking (scan by serial / QR / NFC / barcode via
 * `identifier`), inventory, and per-job material usage which depletes stock.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  createAsset(input: { name: string; type?: AssetType; identifier?: string }) {
    return this.prisma.db.asset.create({ data: { name: input.name, type: input.type ?? 'EQUIPMENT', identifier: input.identifier ?? null } as any });
  }

  listAssets(status?: string) {
    return this.prisma.db.asset.findMany({ where: { ...(status ? { status: status as any } : {}) }, orderBy: { name: 'asc' } });
  }

  assignAsset(assetId: string, userId: string | null) {
    return this.prisma.db.asset.update({ where: { id: assetId }, data: { assignedToId: userId, status: userId ? 'ASSIGNED' : 'AVAILABLE' } });
  }

  /** Resolve an asset from a scanned code (QR/NFC/barcode/serial). */
  async scan(identifier: string) {
    const asset = await this.prisma.db.asset.findFirst({ where: { identifier } });
    if (!asset) throw new NotFoundException('Unknown asset code');
    return asset;
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  createItem(input: { name: string; sku?: string; unit?: string; quantity?: number; reorderLevel?: number }) {
    return this.prisma.db.inventoryItem.create({
      data: { name: input.name, sku: input.sku ?? null, unit: input.unit ?? 'each', quantity: input.quantity ?? 0, reorderLevel: input.reorderLevel ?? null } as any,
    });
  }

  listItems() {
    return this.prisma.db.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  }

  async adjustItem(itemId: string, delta: number) {
    const item = await this.prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    return this.prisma.db.inventoryItem.update({ where: { id: itemId }, data: { quantity: Number(item.quantity) + delta } });
  }

  // ── Material usage ───────────────────────────────────────────────────────
  async recordMaterial(jobId: string, input: { description: string; quantity?: number; unitCost?: number; itemId?: string }) {
    const quantity = input.quantity ?? 1;
    const usage = await this.prisma.db.materialUsage.create({
      data: { jobId, itemId: input.itemId ?? null, description: input.description, quantity, unitCost: input.unitCost ?? null } as any,
    });
    if (input.itemId) await this.adjustItem(input.itemId, -quantity).catch(() => undefined);
    await this.bus.emit({ name: DomainEvents.MATERIAL_USED, tenantId: tenantContext.tenantId, payload: { job: { id: jobId }, material: { id: usage.id, quantity } } });
    return usage;
  }

  listMaterials(jobId: string) {
    return this.prisma.db.materialUsage.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' } });
  }
}
