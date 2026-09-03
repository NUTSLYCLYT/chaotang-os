export function demoInputsFor(slug: string): Record<string, string> {
  if (slug === "single-product-export-diagnosis") {
    return {
      productName: "LFP Battery Pack",
      productCategory: "储能电池PACK",
      knownParameters: "51.2V 100Ah，循环寿命待测试报告确认",
      certifications: "UN38.3 / MSDS 已有扫描件",
      currentPriceOrCost: "FOB 参考价待人工确认",
      monthlyCapacity: "2000 sets/month",
      deliveryCycle: "30 days",
      targetMarket: "Germany",
      plannedChannel: "海外经销商",
      productMaterials: "产品手册、测试摘要、包装照片（demo=true）",
    };
  }
  if (slug === "contract-cashflow-risk") {
    return {
      contractText: "Buyer pays 30% advance, 60% after delivery and 10% after buyer acceptance. Acceptance shall be confirmed by buyer satisfaction.",
      contractAmount: "120000",
      currency: "USD",
      paymentMilestones: "30% advance / 60% after delivery / 10% after acceptance",
      deliveryCycle: "45 days",
      acceptanceMethod: "客户满意后验收",
      warrantyResponsibility: "24 months warranty, details to be confirmed",
      counterpartyName: "NorthGrid Energy FZE",
      targetRegion: "UAE",
      hasHistory: "no",
    };
  }
  if (slug === "b2b-inquiry-conversion") {
    return {
      inquirySource: "阿里国际站",
      customerName: "Alex",
      customerCompany: "NorthGrid Energy",
      countryRegion: "UAE",
      contact: "alex@northgrid.example",
      inquiryTime: "2026-09-03",
      customerOriginalText: "We need 100 pcs 51.2V 100Ah battery pack for solar project. Please share price and delivery time.",
      productDemand: "51.2V 100Ah battery pack",
      quantity: "100 pcs",
      applicationScenario: "solar storage project",
      paymentMethod: "T/T",
      requiresSample: "yes",
    };
  }
  if (slug === "enterprise-growth-diagnosis") {
    return {
      industry: "储能外贸",
      region: "广东",
      targetMarkets: "EU, Middle East",
      products: "Battery Pack",
      stage: "成长期",
      threeMonthMetrics: JSON.stringify({
        sales: 900000,
        profitMargin: 18,
        grossProfit: 162000,
        cashflow: -50000,
        aov: 30000,
        inquiries: 120,
        conversionRate: 8,
        cac: 600,
      }, null, 2),
      topProblems: "获客贵, 回款慢, 利润下滑",
      budgetLimit: "30000 CNY",
      availablePeople: "2 sales + 1 ops",
      targetCollectionCycle: "45 days",
    };
  }
  return {
    projectName: "Demo RFQ",
    customerRequirement: "Need proposal and quotation framework.",
  };
}

export function normalizeSceneInputs(values: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (key === "threeMonthMetrics") {
      try {
        result[key] = JSON.parse(trimmed);
      } catch {
        result[key] = trimmed;
      }
      continue;
    }
    if (key === "targetMarkets" || key === "products" || key === "topProblems") {
      result[key] = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    result[key] = trimmed;
  }
  return result;
}
