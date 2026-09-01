import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Verifica se a API está no ar' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'finlar-bot-api' },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
