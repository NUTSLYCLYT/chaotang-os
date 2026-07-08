import Link from 'next/link';
import type { SellerProfile, TradeOrder } from '@/shared/battery-exchange';
import type {
  OperatorOrderSeverityFilter,
  OperatorOrderSort,
  OperatorOrderStatusFilter,
} from '../lib/operator-console-utils';
import {
  formatOperatorAmount,
  formatOperatorTradeStatus,
  OperatorEmptyNotice,
  OperatorFilterChip,
  OperatorFilterSelect,
  OperatorPanel,
} from './battery-exchange-operator-ui';

export function BatteryExchangeOperatorTradeRisksSection({
  orderSort,
  onOrderSortChange,
  orderSellerId,
  onOrderSellerChange,
  orderSeverity,
  onOrderSeverityChange,
  orderStatus,
  onOrderStatusChange,
  sellers,
  visibleRiskyOrders,
}: {
  orderSort: OperatorOrderSort;
  onOrderSortChange: (value: OperatorOrderSort) => void;
  orderSellerId: string;
  onOrderSellerChange: (value: string) => void;
  orderSeverity: OperatorOrderSeverityFilter;
  onOrderSeverityChange: (value: OperatorOrderSeverityFilter) => void;
  orderStatus: OperatorOrderStatusFilter;
  onOrderStatusChange: (value: OperatorOrderStatusFilter) => void;
  sellers: SellerProfile[];
  visibleRiskyOrders: TradeOrder[];
}) {
  return (
    <OperatorPanel eyebrow="Trade Risks" title="高风险交易">
      <div className="mb-4 flex flex-wrap gap-2 text-xs text-[#d9bb97]">
        <OperatorFilterChip active={orderSort === 'amount_desc'} onClick={() => onOrderSortChange('amount_desc')}>
          按金额
        </OperatorFilterChip>
        <OperatorFilterChip active={orderSort === 'risk_desc'} onClick={() => onOrderSortChange('risk_desc')}>
          按风险
        </OperatorFilterChip>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <OperatorFilterSelect
          label="卖家主体"
          value={orderSellerId}
          onChange={onOrderSellerChange}
          options={[
            { value: 'all', label: '全部卖家' },
            ...sellers.map((seller) => ({ value: seller.id, label: seller.companyName })),
          ]}
        />
        <OperatorFilterSelect
          label="风险级别"
          value={orderSeverity}
          onChange={(value) => onOrderSeverityChange(value as OperatorOrderSeverityFilter)}
          options={[
            { value: 'all', label: '全部风险' },
            { value: 'high', label: '仅高风险' },
            { value: 'medium', label: '中高风险' },
          ]}
        />
        <OperatorFilterSelect
          label="交易状态"
          value={orderStatus}
          onChange={(value) => onOrderStatusChange(value as OperatorOrderStatusFilter)}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'awaiting_inspection', label: '待验货' },
            { value: 'in_dispute', label: '争议中' },
          ]}
        />
      </div>
      <div className="space-y-3">
        {visibleRiskyOrders.length > 0 ? (
          visibleRiskyOrders.slice(0, 4).map((order) => (
            <Link
              key={order.id}
              href={`/battery-exchange/trade-orders/${order.id}`}
              className="block rounded-[20px] border border-[#4b2f24] bg-[#160f0d] px-4 py-4 transition hover:border-[#c98a49]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#f6dfbc]">{order.buyerCompany}</div>
                  <div className="mt-1 text-xs text-[#b99876]">
                    {order.id} · {formatOperatorTradeStatus(order.status)} · {order.quantity} 件
                  </div>
                </div>
                <div className="text-right text-xs text-[#f0c27b]">
                  <div>¥{formatOperatorAmount(order.totalAmountCny)}</div>
                  <div>{Math.round(order.escrowRatio * 100)}% 托管</div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-xs leading-6 text-[#d9bb97]">
                {order.riskFlags.map((risk) => (
                  <div key={risk.id}>• {risk.note}</div>
                ))}
              </div>
            </Link>
          ))
        ) : (
          <OperatorEmptyNotice text="当前没有高风险交易单。" />
        )}
      </div>
    </OperatorPanel>
  );
}
