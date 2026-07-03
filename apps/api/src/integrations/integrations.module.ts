import { Global, Module } from '@nestjs/common';
import { CryptoService } from '../common/crypto/crypto.service';
import { ProviderFactory } from './provider-factory.service';
import { CommsService } from './comms.service';

/**
 * Exposes the integration layer to the rest of the app. Global so any agent or
 * automation handler can inject CommsService / ProviderFactory without re-import.
 */
@Global()
@Module({
  providers: [CryptoService, ProviderFactory, CommsService],
  exports: [CryptoService, ProviderFactory, CommsService],
})
export class IntegrationsModule {}
