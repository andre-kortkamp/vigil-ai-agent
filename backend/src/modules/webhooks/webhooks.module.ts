import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { AgentModule } from '../agent/agent.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';

@Module({
  imports: [AgentModule, EnrichmentModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
