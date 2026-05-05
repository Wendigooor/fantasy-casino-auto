// product/apps/api/src/services/events.ts
import { EventEmitter } from 'events';

const eventEmitter = new EventEmitter();

export const emitEvent = (event: string, payload: Record<string, any>) => {
  eventEmitter.emit(event, payload);
  console.log(`[EVENT] ${event}`, JSON.stringify(payload));
};

export const onEvent = (event: string, handler: (payload: any) => void) => {
  eventEmitter.on(event, handler);
};

export const playerWithdrawalCompleted = (payload: {
  playerId: string;
  amount: number;
  currency: string;
  transactionId: string;
  requestId: string;
}) => {
  emitEvent('player_withdrawal_completed', payload);
};
