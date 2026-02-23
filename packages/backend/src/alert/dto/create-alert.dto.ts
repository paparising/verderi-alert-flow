import { IsNotEmpty, IsUUID, IsString, IsIn, IsOptional } from 'class-validator';
import { AlertStatus } from '../enums/alert-status.enum';

export class CreateAlertDto {
  @IsNotEmpty()
  @IsUUID()
  orgId: string;

  @IsNotEmpty()
  @IsString()
  alertContext: string;

  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: AlertStatus;

  @IsNotEmpty()
  @IsUUID()
  createdBy: string;
}
