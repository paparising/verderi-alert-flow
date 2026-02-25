import { IsNotEmpty, IsUUID, IsString, IsIn, IsOptional } from 'class-validator';
import { AlertStatus } from '../enums/alert-status.enum';

// orgId and createdBy come from JWT context in the API layer; they are optional on the wire.
export class CreateAlertDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;

  @IsNotEmpty()
  @IsString()
  alertContext: string;

  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: AlertStatus;

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
