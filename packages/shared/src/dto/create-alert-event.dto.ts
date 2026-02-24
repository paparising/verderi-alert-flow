import { IsNotEmpty, IsUUID, IsObject } from 'class-validator';

export class CreateAlertEventDto {
  @IsNotEmpty()
  @IsUUID()
  orgId: string;

  @IsNotEmpty()
  @IsObject()
  eventData: Record<string, any>;

  @IsNotEmpty()
  @IsUUID()
  createdBy: string;
}
