import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AgentModule } from './modules/agent/agent.module';

@Module({
  imports: [PrismaModule, AgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
