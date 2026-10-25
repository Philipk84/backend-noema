import { NotFoundException } from '@nestjs/common';

export class NotificationNotFoundException extends NotFoundException {
  constructor(notificationId: number, internalCode?: string) {
    super({
      error: 'Notification Not Found',
      message: `La notificación con identificador ${notificationId} no fue encontrada.`,
      code: internalCode,
    });
  }
}