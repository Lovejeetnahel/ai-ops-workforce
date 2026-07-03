import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
@UseGuards(RolesGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get()
  @Roles('ADMIN')
  list() {
    return this.workflows.list();
  }

  @Get(':id')
  @Roles('ADMIN')
  get(@Param('id') id: string) {
    return this.workflows.get(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.workflows.create(body);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.workflows.update(id, body);
  }

  @Post(':id/publish')
  @Roles('ADMIN')
  publish(@Param('id') id: string) {
    return this.workflows.publish(id);
  }

  @Post(':id/version')
  @Roles('ADMIN')
  version(@Param('id') id: string) {
    return this.workflows.newVersion(id);
  }

  @Post(':id/test')
  @Roles('ADMIN')
  test(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workflows.testRun(id, body);
  }

  @Get(':id/runs')
  @Roles('ADMIN')
  runs(@Param('id') id: string) {
    return this.workflows.listRuns(id);
  }

  @Get(':id/analytics')
  @Roles('ADMIN')
  analytics(@Param('id') id: string) {
    return this.workflows.analytics(id);
  }

  @Get(':id/export')
  @Roles('ADMIN')
  export(@Param('id') id: string) {
    return this.workflows.export(id);
  }

  @Post('import')
  @Roles('ADMIN')
  import(@Body() body: any) {
    return this.workflows.import(body);
  }
}
