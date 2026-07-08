'use client';

import type { OperatorActionLabel } from '@/shared/battery-exchange';
import type {
  OperatorListingFilter,
  OperatorOrderSeverityFilter,
  OperatorOrderSort,
  OperatorOrderStatusFilter,
} from './operator-console-utils';

export type OperatorActionEntityFilter = 'all' | 'listing' | 'trade_order';
export type OperatorActionRangeFilter = 'all' | 'today' | 'recent_24h';
export type OperatorActionSort = 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency';

export type OperatorConsoleShareState = {
  listingFilter: OperatorListingFilter;
  orderSort: OperatorOrderSort;
  reviewSellerId: string;
  reviewCity: string;
  orderSellerId: string;
  orderSeverity: OperatorOrderSeverityFilter;
  orderStatus: OperatorOrderStatusFilter;
  actionEntityFilter: OperatorActionEntityFilter;
  actionLabelFilter: 'all' | OperatorActionLabel;
  actionRangeFilter: OperatorActionRangeFilter;
  actionDateFilter: string;
  actionActorFilter: string;
  actionSellerFilter: string;
  actionQuery: string;
  actionSort: OperatorActionSort;
  actionPage: number;
};

export const DEFAULT_OPERATOR_CONSOLE_SHARE_STATE: OperatorConsoleShareState = {
  listingFilter: 'all',
  orderSort: 'amount_desc',
  reviewSellerId: 'all',
  reviewCity: 'all',
  orderSellerId: 'all',
  orderSeverity: 'all',
  orderStatus: 'all',
  actionEntityFilter: 'all',
  actionLabelFilter: 'all',
  actionRangeFilter: 'all',
  actionDateFilter: '',
  actionActorFilter: 'all',
  actionSellerFilter: 'all',
  actionQuery: '',
  actionSort: 'recent',
  actionPage: 1,
};

const LISTING_FILTERS = new Set<OperatorListingFilter>(['all', 'attention', 'high_risk']);
const ORDER_SORTS = new Set<OperatorOrderSort>(['amount_desc', 'risk_desc']);
const ORDER_SEVERITIES = new Set<OperatorOrderSeverityFilter>(['all', 'high', 'medium']);
const ORDER_STATUSES = new Set<OperatorOrderStatusFilter>(['all', 'awaiting_inspection', 'in_dispute']);
const ACTION_ENTITY_FILTERS = new Set<OperatorActionEntityFilter>(['all', 'listing', 'trade_order']);
const ACTION_RANGE_FILTERS = new Set<OperatorActionRangeFilter>(['all', 'today', 'recent_24h']);
const ACTION_SORTS = new Set<OperatorActionSort>([
  'recent',
  'action_frequency',
  'actor_frequency',
  'seller_frequency',
]);
const ACTION_LABELS = new Set<'all' | OperatorActionLabel>([
  'all',
  '转人工审核',
  '联系卖家补件',
  '标记待补资料',
  '升级争议处理',
  '催验货结果',
]);

function parseEnumValue<T extends string>(value: string | null | undefined, valid: Set<T>, fallback: T): T {
  return value && valid.has(value as T) ? (value as T) : fallback;
}

function parseToken(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function parsePositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseOperatorConsoleShareState(
  getValue:
    | URLSearchParams
    | {
        get: (key: string) => string | null | undefined;
      },
): OperatorConsoleShareState {
  const actionDateFilter = parseToken(getValue.get('actionDate'), '');

  return {
    listingFilter: parseEnumValue(
      getValue.get('listingFilter'),
      LISTING_FILTERS,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.listingFilter,
    ),
    orderSort: parseEnumValue(
      getValue.get('orderSort'),
      ORDER_SORTS,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSort,
    ),
    reviewSellerId: parseToken(
      getValue.get('reviewSeller'),
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewSellerId,
    ),
    reviewCity: parseToken(getValue.get('reviewCity'), DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewCity),
    orderSellerId: parseToken(getValue.get('orderSeller'), DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSellerId),
    orderSeverity: parseEnumValue(
      getValue.get('orderSeverity'),
      ORDER_SEVERITIES,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSeverity,
    ),
    orderStatus: parseEnumValue(
      getValue.get('orderStatus'),
      ORDER_STATUSES,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderStatus,
    ),
    actionEntityFilter: parseEnumValue(
      getValue.get('actionEntity'),
      ACTION_ENTITY_FILTERS,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionEntityFilter,
    ),
    actionLabelFilter: parseEnumValue(
      getValue.get('actionLabel'),
      ACTION_LABELS,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionLabelFilter,
    ),
    actionRangeFilter: actionDateFilter
      ? 'all'
      : parseEnumValue(
          getValue.get('actionRange'),
          ACTION_RANGE_FILTERS,
          DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionRangeFilter,
        ),
    actionDateFilter,
    actionActorFilter: parseToken(
      getValue.get('actionActor'),
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionActorFilter,
    ),
    actionSellerFilter: parseToken(
      getValue.get('actionSeller'),
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSellerFilter,
    ),
    actionQuery: parseToken(getValue.get('actionQuery'), DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionQuery),
    actionSort: parseEnumValue(
      getValue.get('actionSort'),
      ACTION_SORTS,
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSort,
    ),
    actionPage: parsePositiveInt(
      getValue.get('actionPage'),
      DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionPage,
    ),
  };
}

export function buildOperatorConsoleShareParams(state: OperatorConsoleShareState) {
  const params = new URLSearchParams();

  if (state.listingFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.listingFilter) {
    params.set('listingFilter', state.listingFilter);
  }
  if (state.orderSort !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSort) {
    params.set('orderSort', state.orderSort);
  }
  if (state.reviewSellerId !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewSellerId) {
    params.set('reviewSeller', state.reviewSellerId);
  }
  if (state.reviewCity !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewCity) {
    params.set('reviewCity', state.reviewCity);
  }
  if (state.orderSellerId !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSellerId) {
    params.set('orderSeller', state.orderSellerId);
  }
  if (state.orderSeverity !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSeverity) {
    params.set('orderSeverity', state.orderSeverity);
  }
  if (state.orderStatus !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderStatus) {
    params.set('orderStatus', state.orderStatus);
  }
  if (state.actionEntityFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionEntityFilter) {
    params.set('actionEntity', state.actionEntityFilter);
  }
  if (state.actionLabelFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionLabelFilter) {
    params.set('actionLabel', state.actionLabelFilter);
  }
  if (state.actionRangeFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionRangeFilter) {
    params.set('actionRange', state.actionRangeFilter);
  }
  if (state.actionDateFilter) {
    params.set('actionDate', state.actionDateFilter);
  }
  if (state.actionActorFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionActorFilter) {
    params.set('actionActor', state.actionActorFilter);
  }
  if (state.actionSellerFilter !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSellerFilter) {
    params.set('actionSeller', state.actionSellerFilter);
  }
  if (state.actionQuery.trim()) {
    params.set('actionQuery', state.actionQuery.trim());
  }
  if (state.actionSort !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSort) {
    params.set('actionSort', state.actionSort);
  }
  if (state.actionPage !== DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionPage) {
    params.set('actionPage', String(state.actionPage));
  }

  return params;
}
