'use client';

import { useCallback, useState } from 'react';
import type {
  OperatorListingFilter,
  OperatorOrderSeverityFilter,
  OperatorOrderSort,
  OperatorOrderStatusFilter,
} from './operator-console-utils';
import { DEFAULT_OPERATOR_CONSOLE_SHARE_STATE } from './operator-console-share';

export function useOperatorConsoleFilters() {
  const [listingFilter, setListingFilter] = useState<OperatorListingFilter>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.listingFilter,
  );
  const [orderSort, setOrderSort] = useState<OperatorOrderSort>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSort,
  );
  const [reviewSellerId, setReviewSellerId] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewSellerId);
  const [reviewCity, setReviewCity] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.reviewCity);
  const [orderSellerId, setOrderSellerId] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSellerId);
  const [orderSeverity, setOrderSeverity] = useState<OperatorOrderSeverityFilter>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderSeverity,
  );
  const [orderStatus, setOrderStatus] = useState<OperatorOrderStatusFilter>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.orderStatus,
  );

  const applyConsoleFilters = useCallback(
    (next: {
      listingFilter: OperatorListingFilter;
      orderSort: OperatorOrderSort;
      reviewSellerId: string;
      reviewCity: string;
      orderSellerId: string;
      orderSeverity: OperatorOrderSeverityFilter;
      orderStatus: OperatorOrderStatusFilter;
    }) => {
      setListingFilter(next.listingFilter);
      setOrderSort(next.orderSort);
      setReviewSellerId(next.reviewSellerId);
      setReviewCity(next.reviewCity);
      setOrderSellerId(next.orderSellerId);
      setOrderSeverity(next.orderSeverity);
      setOrderStatus(next.orderStatus);
    },
    [],
  );

  return {
    listingFilter,
    setListingFilter,
    orderSort,
    setOrderSort,
    reviewSellerId,
    setReviewSellerId,
    reviewCity,
    setReviewCity,
    orderSellerId,
    setOrderSellerId,
    orderSeverity,
    setOrderSeverity,
    orderStatus,
    setOrderStatus,
    applyConsoleFilters,
  };
}
