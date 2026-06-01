import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('Eventos')
@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar novo evento do Vigil Summit',
    description: `Registra um novo evento no sistema. Suporta o cenário de escala com **10 eventos regionais simultâneos** — cada evento pode ter público-alvo distinto (manufatura, saúde, financeiro, governo).

A data do evento é essencial para o cálculo automático das fases da régua de comunicação:
- **D-3**: 3 dias antes → antecipação
- **D-1**: 1 dia antes → confirmação de presença
- **D+1**: 1 dia depois → follow-up comercial

Cada lead é vinculado a exatamente um evento via \`eventId\`, permitindo campanhas segmentadas por evento.`,
  })
  @ApiResponse({
    status: 201,
    description: 'Evento criado com sucesso',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        eventId: { type: 'string', example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' },
      },
    },
  })
  async criarEvento(
    @Body() dto: CreateEventDto,
  ): Promise<{ success: boolean; eventId: string }> {
    const evento = await this.prisma.event.create({
      data: {
        nome: dto.nome,
        dataEvento: new Date(dto.dataEvento),
        publicoAlvo: dto.publicoAlvo,
      },
    });

    return { success: true, eventId: evento.id };
  }
}
