export enum OrderStatus {
  ARMANDOSE = 'ARMANDOSE',
  TERMINADA = 'TERMINADA',
  ENTREGADA = 'ENTREGADA',
  ENTREGA = 'ENTREGA',
  TERMINACIONES = 'TERMINACIONES',
  TODAS = 'TODAS'
}

export type Category = 'ARMANDOSE' | 'TERMINADA' | 'PROGRAMADA' | 'TERMINACIONES' | 'TODAS';

export interface Order {
  id: string;
  client: string;
  deliveryDate: number;
  notes: string;
  status: OrderStatus;
  category: Category;
  createdAt: number;
  saleAmountCents?: number;
  entregadaAt?: number;
  armandoseAt?: number;
  terminadaAt?: number;
  terminacionesAt?: number;
  everProgramada?: boolean;
  programadaFirstAt?: number;
  programadaLastAt?: number;
  archived?: boolean;
  archivedAt?: number;
}

export interface StatusUI {
  label: string;
  value: OrderStatus;
}

export interface DeliveryDateChange {
  date: string;       // ISO datetime que estaba antes del cambio
  changedAt: string;  // cuándo se hizo el cambio
}