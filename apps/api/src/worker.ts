import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ActionWorker } from './automation/action.worker';

/**
 * Worker entrypoint — same Nest container, no HTTP server. It is the *consumer*
 * side of the automation engine: it drains the BullMQ "automation" queue and
 * executes actions (send SMS/email, generate docs, run agents). Scaled
 * independently of the API so a flood of outbound work never slows web requests.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const worker = app.get(ActionWorker);
  await worker.start();

  Logger.log('Automation worker started', 'Worker');
}

bootstrap();
