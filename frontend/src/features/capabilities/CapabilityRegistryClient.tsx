"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  CapabilityCatalogMetadata,
  CapabilityRegistryItem,
  CapabilityRegistryProjection,
} from "../../lib/backendClient";
import {
  buildCapabilityRegistryViewModel,
  capabilityBadge,
} from "./capabilityRegistryViewModel";
import styles from "./CapabilityRegistry.module.css";

type ApiState =
  | { status: "loading" }
  | { status: "ready"; registry: CapabilityRegistryProjection }
  | { status: "error"; message: string };

const READINESS_LABELS: Array<
  [keyof CapabilityCatalogMetadata["readiness"], string]
> = [
  ["visibilityStatus", "可见"],
  ["installationStatus", "安装"],
  ["connectionStatus", "连接"],
  ["verificationStatus", "验证"],
  ["runtimeBindingStatus", "运行绑定"],
];

const METADATA_LABELS: Record<string, string> = {
  session_visible: "当前会话可见",
  catalog_visible: "目录可见",
  source_present_dependencies_unproven: "源码已存在，依赖待核实",
  see_current_status: "以当前状态为准",
  not_applicable_or_unknown: "不适用或待核实",
  connected: "已连接",
  blocked: "受阻",
  inherit_provider_status: "继承服务组状态",
  not_individually_verified: "未逐项验证",
  connection_or_inventory_verified: "连接或清单已验证",
  see_current_status_and_evidence: "查看当前状态与证据",
  executed_with_evidence: "已实际执行并留有证据",
  not_bound: "未绑定",
  skill_has_no_separate_fee_underlying_service_may_charge:
    "Skill 本身不另收费；底层服务可能收费",
  may_send_selected_data: "可能发送你选择的数据",
  no_external_send_declared_or_task_dependent:
    "未声明固定外发；按具体任务判断",
};

export function capabilityMetadataLabel(value: string): string {
  return METADATA_LABELS[value] ?? value;
}

function matchesQuery(item: CapabilityRegistryItem, query: string): boolean {
  if (!query) return true;
  const catalog = item.catalog;
  const searchable = [
    item.card.name,
    item.card.bestUseCase,
    catalog?.category,
    catalog?.naturalLanguageTrigger,
    catalog?.explicitTrigger,
    catalog?.providerGroup,
    ...(catalog?.tools.map((tool) => tool.name) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
  return searchable.includes(query.toLocaleLowerCase("zh-CN"));
}

function ReadinessGrid({ catalog }: { catalog: CapabilityCatalogMetadata }) {
  return (
    <dl className={styles.readiness}>
      {READINESS_LABELS.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{capabilityMetadataLabel(catalog.readiness[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function CatalogDetails({ item }: { item: CapabilityRegistryItem }) {
  const catalog = item.catalog;
  if (!catalog) return null;
  return (
    <div className={styles.detailBody}>
      <div className={styles.triggerBox}>
        <span>平时这样说</span>
        <strong>{catalog.naturalLanguageTrigger}</strong>
        <span>固定调用</span>
        <code>{catalog.explicitTrigger ?? "无单独命令，直接描述任务"}</code>
      </div>
      <ReadinessGrid catalog={catalog} />
      <dl className={styles.boundaries}>
        <div>
          <dt>费用</dt>
          <dd>{capabilityMetadataLabel(catalog.feeStatus)}</dd>
        </div>
        <div>
          <dt>权限</dt>
          <dd>{catalog.permissionSummary}</dd>
        </div>
        <div>
          <dt>数据外发</dt>
          <dd>{capabilityMetadataLabel(catalog.externalData)}</dd>
        </div>
      </dl>
      <p className={styles.blocker}>
        <strong>当前阻挡：</strong>
        {catalog.blocker}
      </p>
    </div>
  );
}

function HanlinCard({ item }: { item: CapabilityRegistryItem }) {
  return (
    <details className={styles.card}>
      <summary>
        <span className={styles.badge}>{capabilityBadge(item)}</span>
        <h3>{item.card.name}</h3>
        <p>{item.card.bestUseCase}</p>
        <small>{item.catalog?.category ?? "通用能力"} · 展开查看触发方式与边界</small>
      </summary>
      <CatalogDetails item={item} />
    </details>
  );
}

function ProviderCard({ item }: { item: CapabilityRegistryItem }) {
  const catalog = item.catalog;
  if (!catalog) return null;
  return (
    <details className={styles.providerCard}>
      <summary>
        <div>
          <span className={styles.badge}>{capabilityBadge(item)}</span>
          <h3>{item.card.name}</h3>
          <p>{item.card.bestUseCase}</p>
        </div>
        <strong className={styles.toolCount}>{catalog.toolCount} 个工具</strong>
      </summary>
      <CatalogDetails item={item} />
      <details className={styles.toolDrawer}>
        <summary>查看 MCP 工具明细（{catalog.toolCount}）</summary>
        {catalog.tools.length ? (
          <ul>
            {catalog.tools.map((tool) => (
              <li key={tool.id}>
                <code>{tool.name}</code>
                <span>
                  {capabilityMetadataLabel(tool.verificationStatus)} ·{" "}
                  {capabilityMetadataLabel(tool.runtimeBindingStatus)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>该服务组当前没有可投影的 MCP 工具明细。</p>
        )}
      </details>
    </details>
  );
}

export function CapabilityRegistryClient() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/capabilities", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || body?.status !== "ok") {
          setState({
            status: "error",
            message: body?.message ?? "能力总账暂时不可用",
          });
          return;
        }
        setState({ status: "ready", registry: body.registry });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "无法连接能力总账" });
      });
    return () => {
      active = false;
    };
  }, []);

  const view = useMemo(
    () =>
      state.status === "ready"
        ? buildCapabilityRegistryViewModel(state.registry)
        : null,
    [state],
  );
  const normalizedQuery = query.trim();
  const filteredHanlin = useMemo(
    () =>
      view?.hanlinCatalog.filter((item) =>
        matchesQuery(item, normalizedQuery),
      ) ?? [],
    [view, normalizedQuery],
  );
  const filteredProviders = useMemo(
    () =>
      view?.externalProviderGroups.filter((item) =>
        matchesQuery(item, normalizedQuery),
      ) ?? [],
    [view, normalizedQuery],
  );

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>CapabilityRegistry V2 · 只读能力目录</p>
        <h1>朝堂能力总账</h1>
        <p>
          翰林院收录个人方法与 Skill，鸿胪寺收录外部服务与 MCP。这里帮助你挑选能力，
          不会因为“看得见”就自动安装、连接或运行。
        </p>
        <nav className={styles.actions} aria-label="能力总账入口">
          <a href="#hanlin">看翰林院</a>
          <a href="#honglusi">看鸿胪寺</a>
          <a href="#readiness">理解五种状态</a>
          <a href="/junjichu">前往军机处</a>
        </nav>
      </section>

      {state.status === "loading" ? (
        <p className={styles.state}>正在读取只读能力总账……</p>
      ) : null}
      {state.status === "error" ? (
        <p className={styles.state}>{state.message}</p>
      ) : null}

      {view ? (
        <>
          <section className={styles.tiles} aria-label="个人能力目录总览">
            {view.tiles.map((tile) => (
              <article className={styles.tile} key={tile.label}>
                <span>{tile.label}</span>
                <strong>{tile.value}</strong>
                <p>{tile.hint}</p>
              </article>
            ))}
          </section>

          <section className={styles.notice} id="readiness">
            <div>
              <p className={styles.eyebrow}>先看状态，再谈调用</p>
              <h2>五种状态彼此独立</h2>
            </div>
            <p>
              可见、已安装、已连接、已验证、已绑定运行时是五件不同的事。
              当前个人目录全部是 <code>not_bound</code>，所以只用于推荐和起草协作方案。
            </p>
          </section>

          <label className={styles.search}>
            <span>搜索能力、用途或触发语</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：调试、Figma、短视频"
            />
          </label>

          <section className={styles.panel} id="hanlin">
            <header className={styles.panelHead}>
              <div>
                <p className={styles.eyebrow}>翰林院荐才簿</p>
                <h2>直接说出结果，翰林院按语义推荐方法</h2>
              </div>
              <strong>{filteredHanlin.length} 项</strong>
            </header>
            <div className={styles.cardGrid}>
              {filteredHanlin.map((item) => (
                <HanlinCard item={item} key={item.card.id} />
              ))}
            </div>
          </section>

          <section className={styles.panel} id="honglusi">
            <header className={styles.panelHead}>
              <div>
                <p className={styles.eyebrow}>鸿胪寺候选簿</p>
                <h2>外部能力按服务组收口，工具明细折叠查看</h2>
              </div>
              <strong>{filteredProviders.length} 组</strong>
            </header>
            <div className={styles.providerGrid}>
              {filteredProviders.map((item) => (
                <ProviderCard item={item} key={item.card.id} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
