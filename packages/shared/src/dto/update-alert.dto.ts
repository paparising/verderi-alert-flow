import { IsIn, IsOptional, IsString } from 'class-validator';
import { AlertStatus } from '../enums/alert-status.enum';

// orgId and updatedBy come from JWT context; frontend sends only mutable fields.
export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  alertContext?: string;

  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: AlertStatus;
}
