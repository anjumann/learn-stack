import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PresignRequestDto, ConfirmUploadDto } from '@docvault/types';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  /** List all documents */
  @Get()
  list() {
    return this.svc.findAll();
  }

  /** Step 1 of upload: get presigned PUT URL + create pending document record */
  @Post('presign')
  presign(@Body() dto: PresignRequestDto) {
    return this.svc.presign(dto);
  }

  /** Step 2 of upload: confirm upload completed, trigger SNS event */
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmUploadDto) {
    return this.svc.confirm(id, dto.s3Key);
  }

  /** Get presigned GET URL for document download */
  @Get(':id/download')
  download(@Param('id') id: string) {
    return this.svc.presignDownload(id).then((url) => ({ url }));
  }

  /** Soft-delete document — publishes document.deleted SNS event */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }
}
