import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
