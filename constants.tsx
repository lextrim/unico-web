import { OrderStatus, StatusUI, Category } from './types';

export const STATUS_OPTIONS: StatusUI[] = [
  { label: 'ARMANDOSE', value: OrderStatus.ARMANDOSE },
  { label: 'TERMINADA', value: OrderStatus.TERMINADA },
  { label: 'ENTREGAS', value: OrderStatus.ENTREGADA },
  { label: 'TERMINACIONES', value: OrderStatus.TERMINACIONES },
  { label: 'TODAS', value: OrderStatus.TODAS }
];

// Pestañas del menú (categorías)
export const CATEGORIES: Category[] = ['ARMANDOSE', 'TERMINADA', 'PROGRAMADA', 'TERMINACIONES', 'TODAS'];

export const APP_COLORS = {
  primary: 'bg-blue-600',
  secondary: 'bg-slate-800',
  accent: 'bg-amber-500',
  danger: 'bg-red-600',
  success: 'bg-emerald-600'
};
