import { IsNotEmpty, IsIn } from 'class-validator';
import { AlertStatus } from '../enums/alert-status.enum';

export class UpdateAlertStatusDto {
  @IsNotEmpty()
  @IsIn(Object.values(AlertStatus))
  status: AlertStatus;
}
