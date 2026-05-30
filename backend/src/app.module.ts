import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AgentModule } from './modules/agent/agent.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [PrismaModule, AgentModule, WebhooksModule, EnrichmentModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
