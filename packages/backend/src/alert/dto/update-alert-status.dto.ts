import { IsNotEmpty, IsIn, IsUUID } from 'class-validator';
import { AlertStatus } from '../enums/alert-status.enum';

export class UpdateAlertStatusDto {
  @IsNotEmpty()
  @IsUUID()
  orgId: string;

  @IsNotEmpty()
  @IsIn(Object.values(AlertStatus))
  status: AlertStatus;

  @IsNotEmpty()
  @IsUUID()
  updatedBy: string;
}
