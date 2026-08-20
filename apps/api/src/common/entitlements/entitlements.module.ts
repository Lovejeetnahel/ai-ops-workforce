import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/** Global so every feature module can enforce limits without extra imports. */
@Global()
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
