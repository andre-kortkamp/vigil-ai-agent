import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check da API',
    description: 'Endpoint raiz para verificação de disponibilidade da API. Retorna uma string de confirmação. Usado para monitoramento e validação de deploy.',
  })
  @ApiResponse({
    status: 200,
    description: 'API operacional',
    schema: { type: 'string', example: 'Vigil.AI Agent API — Operacional 🚀' },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
