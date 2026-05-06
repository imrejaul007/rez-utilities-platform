/**
 * Notification entity types
 * Includes INotification and INotificationEvent
 */

import { NotificationType, NotificationChannel } from '../enums/index';

export interface INotificationEvent {
  type: NotificationType;
  entityId?: string;
  entityType?: string;
  data?: Record<string, any>;
}

export interface INotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  pushToken?: string;
}

export interface INotification {
  _id?: string;
  event: INotificationEvent;
  recipients: INotificationRecipient[];
  type: NotificationType;
  channel: NotificationChannel;
  title?: string;
  message: string;
  payload?: Record<string, any>;
  isRead?: boolean;
  readAt?: Date;
  sentAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt?: Date;
}
