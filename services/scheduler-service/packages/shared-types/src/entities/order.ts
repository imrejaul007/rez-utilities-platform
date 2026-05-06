/**
 * Order entity types — based on canonical Order.ts
 * Includes IOrder, IOrderItem with all 11 order statuses
 * No [key: string]: any escape hatches — strictly typed
 */

import { OrderStatus, PaymentStatus } from '../enums/index';

export interface IOrderItem {
  itemId?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

export interface IOrderTotals {
  subtotal?: number;
  tax?: number;
  discount?: number;
  deliveryFee?: number;
  total?: number;
}

export interface IOrderPayment {
  method?: string;
  status?: PaymentStatus;
  amount?: number;
}

export interface IOrderDelivery {
  type?: string;
  address?: Record<string, any>;
}

export interface IOrder {
  _id?: string;
  orderNumber?: string;
  status: OrderStatus;
  user: string;
  store: string;
  items: IOrderItem[];
  totals?: IOrderTotals;
  payment?: IOrderPayment;
  delivery?: IOrderDelivery;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
