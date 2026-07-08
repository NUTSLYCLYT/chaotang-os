/**
 * SQL DDL statements for all database tables
 * All statements use IF NOT EXISTS for idempotent migrations
 *
 * DATA-DRIFT-01 — DEFAULT 字面量与 TaskStatus / AgentRunStatus 契约对齐说明：
 *
 * 1. tasks.status：契约 TaskStatus 合法初值为 'submitted'（见 contracts/task.ts）。
 *    新建任务语义与 LEGACY_TASK_STATUS_MAP 的 `pending → submitted` 一致，DEFAULT 已改为 'submitted'。
 *    注意：本表用 CREATE TABLE IF NOT EXISTS，已存在的历史库其列 DEFAULT 不会被本次变更回写——
 *    历史库中残留的 'pending' 行须经 LEGACY_TASK_STATUS_MAP（'pending' → 'submitted'）在读取层适配。
 *
 * 2. agent_runs.status：'running' 是合法 AgentState 的「运行中」初值，但不属于 AgentRunStatus 的终态集合
 *    （completed | failed | fallback_completed）。这里保留 'running' 作为运行中初值，终态由 UPDATE
 *    在 run 结束时写入 completed / failed；如下游按 AgentRunStatus 枚举消费，须经 LEGACY_MAP 适配。
 *
 * 本次仅调整 DEFAULT 字面量 + 注释，不改列结构、不动其它表，向后兼容（仅对新建库生效）。
 */

export const CREATE_TENANTS_TABLE = `
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const CREATE_TENANT_MEMBERS_TABLE = `
  CREATE TABLE IF NOT EXISTS tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    member_role TEXT NOT NULL DEFAULT 'member'
      CHECK (member_role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_TENANT_MEMBERS_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_user
    ON tenant_members(tenant_id, user_id);
`;

export const CREATE_TENANT_MEMBERS_USER_INDEX = `
  CREATE INDEX IF NOT EXISTS tenant_members_user
    ON tenant_members(user_id);
`;

export const CREATE_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT NOT NULL,
    raw_command TEXT NOT NULL,
    -- DATA-DRIFT-01: 契约 TaskStatus 合法初值，原 'pending' 不在枚举内（历史库经 LEGACY_TASK_STATUS_MAP 适配）
    status TEXT NOT NULL DEFAULT 'submitted',
    mode TEXT NOT NULL DEFAULT 'normal',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    plan_json TEXT,
    result_json TEXT,
    retro_json TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_TASKS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS tasks_tenant_updated
    ON tasks(tenant_id, updated_at DESC);
`;

export const CREATE_AGENT_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    task_id TEXT NOT NULL,
    agent_code TEXT NOT NULL,
    -- DATA-DRIFT-01: 运行中态初值（合法 AgentState）；终态由 UPDATE 写入 completed/failed（AgentRunStatus 经 LEGACY_MAP 适配）
    status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    input_json TEXT,
    output_json TEXT,
    token_cost_usd REAL,
    intent TEXT DEFAULT 'other',
    user_intent_raw TEXT,
    swarm_id TEXT,
    route_type TEXT,
    user_id TEXT,
    created_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_AGENT_RUNS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS agent_runs_tenant_created
    ON agent_runs(tenant_id, created_at DESC);
`;

export const CREATE_LESSONS_TABLE = `
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    task_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    tags TEXT,
    outcome TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_LESSONS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS lessons_tenant_created
    ON lessons(tenant_id, created_at DESC);
`;

export const CREATE_INTEL_SIGNALS_TABLE = `
  CREATE TABLE IF NOT EXISTS intel_signals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'normal',
    region TEXT,
    impact_score REAL DEFAULT 0.5,
    sources_json TEXT,
    embedding BLOB,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_INTEL_SIGNALS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS intel_signals_tenant_created
    ON intel_signals(tenant_id, created_at DESC);
`;

export const CREATE_INTEL_SIGNAL_ROUTES_TABLE = `
  CREATE TABLE IF NOT EXISTS intel_signal_routes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    signal_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    user_id TEXT,
    target_agents_json TEXT NOT NULL DEFAULT '[]',
    entry_swarm TEXT NOT NULL DEFAULT '',
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    status TEXT NOT NULL DEFAULT 'submitted',
    note TEXT,
    session_id TEXT,
    trace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_INTEL_SIGNAL_ROUTES_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS intel_signal_routes_task
    ON intel_signal_routes(task_id);
`;

export const CREATE_INTEL_SIGNAL_ROUTES_SIGNAL_INDEX = `
  CREATE INDEX IF NOT EXISTS intel_signal_routes_signal_created
    ON intel_signal_routes(signal_id, created_at DESC);
`;

export const CREATE_INTEL_EVIDENCE_PACKS_TABLE = `
  CREATE TABLE IF NOT EXISTS intel_evidence_packs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    signal_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    pack_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (route_id) REFERENCES intel_signal_routes(id)
  );
`;

export const CREATE_INTEL_EVIDENCE_PACKS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS intel_evidence_packs_task
    ON intel_evidence_packs(task_id);
`;

/**
 * 锦衣卫 · 异动雷达快照(每次 /api/court/intel/rescan 调用存一份 intel_signals 全量快照)。
 * 只留一份"上一轮"用于下次 diff——每次写入前先读出最近一条做对比,再插入本轮作为新的最近一条。
 * 不做历史留档(那是 archive_records 的职责),纯粹服务 detectChange 的 prev/curr 对比。
 */
export const CREATE_INTEL_SNAPSHOTS_TABLE = `
  CREATE TABLE IF NOT EXISTS intel_snapshots (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_INTEL_SNAPSHOTS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS intel_snapshots_tenant_created
    ON intel_snapshots(tenant_id, created_at DESC);
`;

// 信源历史可信度是信源本身的属性（谁发布的、历史上判"入库"后来是否被证实），
// 不是租户数据，故不设 tenant_id —— 同一信源（如"上海有色网SMM"）对所有租户可信度一致。
// times_confirmed 的回填机制（后来证实为真才 +1）尚未接入任何写入路径；当前只有
// times_cited 在每次引用时 +1（见 recordSourceCitations），所以样本量诚实地停在
// "刚被引用过几次"，credibilityWeight() 的 minSample=5 门槛会让它老实走 unproven 分支。
export const CREATE_INTEL_SOURCE_TRACK_RECORD_TABLE = `
  CREATE TABLE IF NOT EXISTS intel_source_track_record (
    source_name TEXT PRIMARY KEY,
    times_cited INTEGER NOT NULL DEFAULT 0,
    times_confirmed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
`;

export const CREATE_SWARM_SESSION_LINKS_TABLE = `
  CREATE TABLE IF NOT EXISTS swarm_session_links (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    route_id TEXT,
    upstream TEXT NOT NULL DEFAULT 'jiqun',
    entry_swarm TEXT NOT NULL DEFAULT '',
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    status TEXT NOT NULL DEFAULT 'running',
    trace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (route_id) REFERENCES intel_signal_routes(id)
  );
`;

export const CREATE_SWARM_SESSION_LINKS_SESSION_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS swarm_session_links_session
    ON swarm_session_links(upstream, session_id);
`;

export const CREATE_SWARM_SESSION_LINKS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS swarm_session_links_task_created
    ON swarm_session_links(task_id, created_at DESC);
`;

export const CREATE_DECISIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    task_id TEXT,
    petition_id TEXT,
    zhongshu_json TEXT,
    menxia_json TEXT,
    shangshu_json TEXT,
    final_decision TEXT NOT NULL,
    citations_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_DECISIONS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS decisions_tenant_created
    ON decisions(tenant_id, created_at DESC);
`;

export const CREATE_FORECAST_SCENARIOS_TABLE = `
  CREATE TABLE IF NOT EXISTS forecast_scenarios (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    probability REAL NOT NULL DEFAULT 0.33,
    confidence REAL NOT NULL DEFAULT 0.5,
    timeframe_start TEXT NOT NULL,
    timeframe_end TEXT NOT NULL,
    payoff_description TEXT NOT NULL DEFAULT '',
    risk_windows_json TEXT NOT NULL DEFAULT '[]',
    trigger_conditions_json TEXT NOT NULL DEFAULT '[]',
    pre_actions_json TEXT NOT NULL DEFAULT '[]',
    evidence_ids_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_FORECAST_SCENARIOS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS forecast_scenarios_tenant_updated
    ON forecast_scenarios(tenant_id, updated_at DESC);
`;

/** 庄园六部指标存储（Turso 真实数据，替换原 mock manorData.tsx 静态值） */
export const CREATE_MANOR_METRICS_TABLE = `
  CREATE TABLE IF NOT EXISTS manor_metrics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    ministry_key TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    delta TEXT,
    delta_positive INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_MANOR_METRICS_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS manor_metrics_tenant_ministry_label
    ON manor_metrics(tenant_id, ministry_key, metric_label);
`;

export const CREATE_HUBU_PROJECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS hubu_projects (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT NOT NULL,
    target_dept TEXT NOT NULL DEFAULT '',
    owner_dept TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_review',
    requested_budget TEXT NOT NULL DEFAULT '',
    estimated_roi TEXT NOT NULL DEFAULT '',
    payback_window TEXT NOT NULL DEFAULT '',
    cash_flow_pressure TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'P1',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    recommendation TEXT NOT NULL DEFAULT '',
    command TEXT NOT NULL DEFAULT '',
    acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_HUBU_PROJECTS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS hubu_projects_tenant_updated
    ON hubu_projects(tenant_id, updated_at DESC);
`;

export const CREATE_HUBU_SUMMARY_TABLE = `
  CREATE TABLE IF NOT EXISTS hubu_summary (
    id INTEGER PRIMARY KEY DEFAULT 1,
    tenant_id TEXT,
    total_requested TEXT NOT NULL DEFAULT '',
    approved_this_week TEXT NOT NULL DEFAULT '',
    pending_count INTEGER NOT NULL DEFAULT 0,
    avg_roi TEXT NOT NULL DEFAULT '',
    cash_reserve TEXT NOT NULL DEFAULT '',
    recommendation TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_HUBU_SUMMARY_TENANT_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS hubu_summary_tenant
    ON hubu_summary(tenant_id);
`;

/**
 * 太医院 · 健康档案主表（Turso）
 * 每位用户一行，profile_json 存完整 HealthProfile 快照。
 * 刷新部门页时由 BFF /api/court/taiyi/dashboard 查此表并返回前端。
 */
export const CREATE_HEALTH_PROFILES_TABLE = `
  CREATE TABLE IF NOT EXISTS health_profiles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    subject_name TEXT NOT NULL DEFAULT '陛下',
    total_score INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'normal',
    profile_json TEXT NOT NULL,
    data_source TEXT NOT NULL DEFAULT 'fallback',
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_HEALTH_PROFILES_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS health_profiles_tenant_updated
    ON health_profiles(tenant_id, updated_at DESC);
`;

/**
 * 太医院 · 医讯表（Turso）
 * 存储从后端或 Tavily 拉取的医疗新闻条目，供前端 useSWR 消费。
 */
export const CREATE_MEDICAL_NEWS_TABLE = `
  CREATE TABLE IF NOT EXISTS medical_news (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    category TEXT NOT NULL DEFAULT 'ai',
    headline TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    importance INTEGER NOT NULL DEFAULT 50,
    published_at TEXT NOT NULL,
    relevant INTEGER NOT NULL DEFAULT 0,
    tags_json TEXT NOT NULL DEFAULT '[]',
    citations_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_MEDICAL_NEWS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS medical_news_tenant_published
    ON medical_news(tenant_id, published_at DESC);
`;

/** 兵部竞品情报表 */
export const CREATE_BINGBU_COMPETITORS_TABLE = `
  CREATE TABLE IF NOT EXISTS bingbu_competitors (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    name TEXT NOT NULL,
    threat_level TEXT NOT NULL DEFAULT 'medium',
    market_share_pct REAL NOT NULL DEFAULT 0,
    strengths_json TEXT NOT NULL DEFAULT '[]',
    weaknesses_json TEXT NOT NULL DEFAULT '[]',
    latest_move TEXT NOT NULL DEFAULT '',
    sources_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_BINGBU_COMPETITORS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS bingbu_competitors_tenant_updated
    ON bingbu_competitors(tenant_id, updated_at DESC);
`;

/** 兵部 SWOT 分析快照表（单行，rowid=1） */
export const CREATE_BINGBU_SWOT_TABLE = `
  CREATE TABLE IF NOT EXISTS bingbu_swot (
    id INTEGER PRIMARY KEY DEFAULT 1,
    tenant_id TEXT,
    strengths_json TEXT NOT NULL DEFAULT '[]',
    weaknesses_json TEXT NOT NULL DEFAULT '[]',
    opportunities_json TEXT NOT NULL DEFAULT '[]',
    threats_json TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0.75,
    generated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_BINGBU_SWOT_TENANT_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS bingbu_swot_tenant
    ON bingbu_swot(tenant_id);
`;

/** 兵部战略建议表 */
export const CREATE_BINGBU_RECOMMENDATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS bingbu_recommendations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    type TEXT NOT NULL DEFAULT 'observe',
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    citations_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_BINGBU_RECOMMENDATIONS_TENANT_INDEX = `
  CREATE INDEX IF NOT EXISTS bingbu_recommendations_tenant_created
    ON bingbu_recommendations(tenant_id, created_at DESC);
`;

export const CREATE_SHANGSHUFANG_IM_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS shangshufang_im_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    label TEXT NOT NULL,
    text TEXT NOT NULL,
    display_time TEXT NOT NULL,
    mode TEXT CHECK (mode IN ('ask', 'order', 'secret') OR mode IS NULL),
    client_id TEXT,
    created_at TEXT NOT NULL
  );
`;

export const CREATE_SHANGSHUFANG_IM_MESSAGES_USER_INDEX = `
  CREATE INDEX IF NOT EXISTS shangshufang_im_messages_user_session_created
    ON shangshufang_im_messages(user_id, session_id, created_at DESC);
`;

export const CREATE_SHANGSHUFANG_IM_MESSAGES_MODE_INDEX = `
  CREATE INDEX IF NOT EXISTS shangshufang_im_messages_user_session_mode_created
    ON shangshufang_im_messages(user_id, session_id, mode, created_at DESC);
`;

export const CREATE_IMA_KNOWLEDGE_DOCUMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS ima_knowledge_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'text/plain',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    content_text TEXT NOT NULL,
    content_excerpt TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'shangshufang_upload',
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'archived')),
    last_modified INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`;

export const CREATE_IMA_KNOWLEDGE_DOCUMENTS_USER_INDEX = `
  CREATE INDEX IF NOT EXISTS ima_knowledge_documents_user_updated
    ON ima_knowledge_documents(user_id, updated_at DESC);
`;

export const CREATE_IMA_KNOWLEDGE_DOCUMENTS_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS ima_knowledge_documents_user_status_updated
    ON ima_knowledge_documents(user_id, status, updated_at DESC);
`;

export const CREATE_DECISION_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS decision_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'local',
    raw_question TEXT NOT NULL,
    refined_edict TEXT NOT NULL DEFAULT '',
    decision_type TEXT NOT NULL DEFAULT '经营决策判断',
    status TEXT NOT NULL DEFAULT 'draft',
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    risk_flags TEXT NOT NULL DEFAULT '[]',
    known_facts TEXT NOT NULL DEFAULT '[]',
    unknown_gaps TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const CREATE_DECISION_TASKS_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS decision_tasks_status_updated
    ON decision_tasks(status, updated_at DESC);
`;

export const CREATE_DECISION_TASKS_USER_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS decision_tasks_user_status_updated
    ON decision_tasks(user_id, status, updated_at DESC);
`;

export const CREATE_DRAFT_EDICTS_TABLE = `
  CREATE TABLE IF NOT EXISTS draft_edicts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    original_question TEXT NOT NULL,
    refined_edict TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id)
  );
`;

export const CREATE_DRAFT_EDICTS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS draft_edicts_task_created
    ON draft_edicts(task_id, created_at DESC);
`;

export const CREATE_COURT_REVIEWS_TABLE = `
  CREATE TABLE IF NOT EXISTS court_reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    confirmed_edict_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reviewing',
    review_plan_json TEXT NOT NULL DEFAULT '{}',
    selected_departments TEXT NOT NULL DEFAULT '[]',
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id),
    FOREIGN KEY (confirmed_edict_id) REFERENCES draft_edicts(id)
  );
`;

export const CREATE_COURT_REVIEWS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS court_reviews_task_updated
    ON court_reviews(task_id, updated_at DESC);
`;

export const CREATE_DEPARTMENT_REVIEW_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS department_review_runs (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input_json TEXT NOT NULL DEFAULT '{}',
    output_json TEXT,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    trace_id TEXT,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    FOREIGN KEY (review_id) REFERENCES court_reviews(id)
  );
`;

export const CREATE_DEPARTMENT_REVIEW_RUNS_REVIEW_INDEX = `
  CREATE INDEX IF NOT EXISTS department_review_runs_review_started
    ON department_review_runs(review_id, started_at DESC);
`;

export const CREATE_MEMORIALS_TABLE = `
  CREATE TABLE IF NOT EXISTS memorials (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    sacred_judgement TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    content_json TEXT NOT NULL,
    quality_passed INTEGER NOT NULL DEFAULT 0,
    human_confirmation_required INTEGER NOT NULL DEFAULT 0,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES court_reviews(id),
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id)
  );
`;

export const CREATE_MEMORIALS_REVIEW_INDEX = `
  CREATE INDEX IF NOT EXISTS memorials_review_created
    ON memorials(review_id, created_at DESC);
`;

export const CREATE_EMPEROR_DECISIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS emperor_decisions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    memorial_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    human_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmation_record_json TEXT NOT NULL DEFAULT '{}',
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id),
    FOREIGN KEY (review_id) REFERENCES court_reviews(id),
    FOREIGN KEY (memorial_id) REFERENCES memorials(id)
  );
`;

export const CREATE_EMPEROR_DECISIONS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS emperor_decisions_task_created
    ON emperor_decisions(task_id, created_at DESC);
`;

export const CREATE_SHIGUAN_ARCHIVES_TABLE = `
  CREATE TABLE IF NOT EXISTS shiguan_archives (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    memorial_id TEXT NOT NULL,
    archive_json TEXT NOT NULL,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    retrospective_status TEXT NOT NULL DEFAULT 'not_started',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id),
    FOREIGN KEY (review_id) REFERENCES court_reviews(id),
    FOREIGN KEY (memorial_id) REFERENCES memorials(id)
  );
`;

export const CREATE_SHIGUAN_ARCHIVES_CREATED_INDEX = `
  CREATE INDEX IF NOT EXISTS shiguan_archives_created
    ON shiguan_archives(created_at DESC);
`;

export const CREATE_COURT_LOOP_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS court_loop_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    loop_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    input_json TEXT NOT NULL DEFAULT '{}',
    output_json TEXT,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    error TEXT,
    trace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES decision_tasks(id)
  );
`;

export const CREATE_COURT_LOOP_RUNS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS court_loop_runs_task_created
    ON court_loop_runs(task_id, created_at DESC);
`;

export const CREATE_COURT_ISSUES_TABLE = `
  CREATE TABLE IF NOT EXISTS court_issues (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    intent TEXT NOT NULL,
    status TEXT NOT NULL,
    market TEXT,
    ticker TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_COURT_ISSUES_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS court_issues_task_created
    ON court_issues(task_id, created_at DESC);
`;

export const CREATE_DEPARTMENT_MEMORIALS_TABLE = `
  CREATE TABLE IF NOT EXISTS department_memorials (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    source_label TEXT NOT NULL,
    memorial_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_DEPARTMENT_MEMORIALS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS department_memorials_task_created
    ON department_memorials(task_id, created_at DESC);
`;

export const CREATE_DECISION_BRIEFS_TABLE = `
  CREATE TABLE IF NOT EXISTS decision_briefs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    issue_id TEXT NOT NULL,
    evidence_pack_id TEXT,
    status TEXT NOT NULL,
    brief_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (issue_id) REFERENCES court_issues(id)
  );
`;

export const CREATE_DECISION_BRIEFS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS decision_briefs_task_created
    ON decision_briefs(task_id, created_at DESC);
`;

export const CREATE_IMPERIAL_INSTRUCTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS imperial_instructions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    brief_id TEXT NOT NULL,
    instruction_type TEXT NOT NULL,
    decision_actor_json TEXT NOT NULL,
    instruction_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (brief_id) REFERENCES decision_briefs(id)
  );
`;

export const CREATE_IMPERIAL_INSTRUCTIONS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS imperial_instructions_task_created
    ON imperial_instructions(task_id, created_at DESC);
`;

export const CREATE_EXECUTION_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS execution_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    instruction_id TEXT NOT NULL,
    executor TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (instruction_id) REFERENCES imperial_instructions(id)
  );
`;

export const CREATE_EXECUTION_RUNS_INSTRUCTION_INDEX = `
  CREATE INDEX IF NOT EXISTS execution_runs_instruction_created
    ON execution_runs(instruction_id, created_at DESC);
`;

export const CREATE_ARCHIVE_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    archive_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`;

export const CREATE_ARCHIVE_RECORDS_TASK_INDEX = `
  CREATE INDEX IF NOT EXISTS archive_records_task_created
    ON archive_records(task_id, created_at DESC);
`;

/**
 * Array of all DDL statements in execution order
 * Order matters for foreign key constraints:
 * 1. tasks (no dependencies)
 * 2. agent_runs (depends on tasks)
 * 3. lessons (depends on tasks)
 * 4. intel_signals (no dependencies)
 * 5. decisions (optional dependency on tasks)
 * 6. forecast_scenarios (no dependencies)
 * 7. manor_metrics (no dependencies)
 * 8. hubu_projects (户部项目台账)
 * 9. hubu_summary (户部财政摘要)
 * 10. health_profiles (太医院健康档案)
 * 11. medical_news (太医院医讯)
 * 12. bingbu_competitors (兵部竞品情报)
 * 13. bingbu_swot (兵部 SWOT 快照)
 * 14. bingbu_recommendations (兵部战略建议)
 */
export const ALL_DDL_STATEMENTS = [
  CREATE_TENANTS_TABLE,
  CREATE_TENANT_MEMBERS_TABLE,
  CREATE_TENANT_MEMBERS_INDEX,
  CREATE_TENANT_MEMBERS_USER_INDEX,
  CREATE_TASKS_TABLE,
  CREATE_AGENT_RUNS_TABLE,
  CREATE_LESSONS_TABLE,
  CREATE_INTEL_SIGNALS_TABLE,
  CREATE_INTEL_SIGNAL_ROUTES_TABLE,
  CREATE_INTEL_EVIDENCE_PACKS_TABLE,
  CREATE_INTEL_SNAPSHOTS_TABLE,
  CREATE_INTEL_SOURCE_TRACK_RECORD_TABLE,
  CREATE_SWARM_SESSION_LINKS_TABLE,
  CREATE_DECISIONS_TABLE,
  CREATE_FORECAST_SCENARIOS_TABLE,
  CREATE_MANOR_METRICS_TABLE,
  CREATE_HUBU_PROJECTS_TABLE,
  CREATE_HUBU_SUMMARY_TABLE,
  CREATE_HEALTH_PROFILES_TABLE,
  CREATE_MEDICAL_NEWS_TABLE,
  CREATE_BINGBU_COMPETITORS_TABLE,
  CREATE_BINGBU_SWOT_TABLE,
  CREATE_BINGBU_RECOMMENDATIONS_TABLE,
  CREATE_SHANGSHUFANG_IM_MESSAGES_TABLE,
  CREATE_IMA_KNOWLEDGE_DOCUMENTS_TABLE,
  CREATE_DECISION_TASKS_TABLE,
  CREATE_DRAFT_EDICTS_TABLE,
  CREATE_COURT_REVIEWS_TABLE,
  CREATE_DEPARTMENT_REVIEW_RUNS_TABLE,
  CREATE_MEMORIALS_TABLE,
  CREATE_EMPEROR_DECISIONS_TABLE,
  CREATE_SHIGUAN_ARCHIVES_TABLE,
  CREATE_COURT_LOOP_RUNS_TABLE,
  CREATE_COURT_ISSUES_TABLE,
  CREATE_DEPARTMENT_MEMORIALS_TABLE,
  CREATE_DECISION_BRIEFS_TABLE,
  CREATE_IMPERIAL_INSTRUCTIONS_TABLE,
  CREATE_EXECUTION_RUNS_TABLE,
  CREATE_ARCHIVE_RECORDS_TABLE,
];

export const TENANT_INDEX_STATEMENTS = [
  CREATE_TASKS_TENANT_INDEX,
  CREATE_AGENT_RUNS_TENANT_INDEX,
  CREATE_LESSONS_TENANT_INDEX,
  CREATE_INTEL_SIGNALS_TENANT_INDEX,
  CREATE_INTEL_SIGNAL_ROUTES_TASK_INDEX,
  CREATE_INTEL_SIGNAL_ROUTES_SIGNAL_INDEX,
  CREATE_INTEL_EVIDENCE_PACKS_TASK_INDEX,
  CREATE_INTEL_SNAPSHOTS_TENANT_INDEX,
  CREATE_SWARM_SESSION_LINKS_SESSION_INDEX,
  CREATE_SWARM_SESSION_LINKS_TASK_INDEX,
  CREATE_DECISIONS_TENANT_INDEX,
  CREATE_FORECAST_SCENARIOS_TENANT_INDEX,
  CREATE_MANOR_METRICS_INDEX,
  CREATE_HUBU_PROJECTS_TENANT_INDEX,
  CREATE_HUBU_SUMMARY_TENANT_INDEX,
  CREATE_HEALTH_PROFILES_TENANT_INDEX,
  CREATE_MEDICAL_NEWS_TENANT_INDEX,
  CREATE_BINGBU_COMPETITORS_TENANT_INDEX,
  CREATE_BINGBU_SWOT_TENANT_INDEX,
  CREATE_BINGBU_RECOMMENDATIONS_TENANT_INDEX,
  CREATE_SHANGSHUFANG_IM_MESSAGES_USER_INDEX,
  CREATE_SHANGSHUFANG_IM_MESSAGES_MODE_INDEX,
  CREATE_IMA_KNOWLEDGE_DOCUMENTS_USER_INDEX,
  CREATE_IMA_KNOWLEDGE_DOCUMENTS_STATUS_INDEX,
  CREATE_DECISION_TASKS_STATUS_INDEX,
  CREATE_DECISION_TASKS_USER_STATUS_INDEX,
  CREATE_DRAFT_EDICTS_TASK_INDEX,
  CREATE_COURT_REVIEWS_TASK_INDEX,
  CREATE_DEPARTMENT_REVIEW_RUNS_REVIEW_INDEX,
  CREATE_MEMORIALS_REVIEW_INDEX,
  CREATE_EMPEROR_DECISIONS_TASK_INDEX,
  CREATE_SHIGUAN_ARCHIVES_CREATED_INDEX,
  CREATE_COURT_LOOP_RUNS_TASK_INDEX,
  CREATE_COURT_ISSUES_TASK_INDEX,
  CREATE_DEPARTMENT_MEMORIALS_TASK_INDEX,
  CREATE_DECISION_BRIEFS_TASK_INDEX,
  CREATE_IMPERIAL_INSTRUCTIONS_TASK_INDEX,
  CREATE_EXECUTION_RUNS_INSTRUCTION_INDEX,
  CREATE_ARCHIVE_RECORDS_TASK_INDEX,
];

/**
 * Table metadata for tracking and logging
 */
export const TABLE_METADATA = [
  {
    name: "tenants",
    description: "租户主表（企业/个人空间，仅承载数据隔离边界）",
    recordCount: 0,
  },
  {
    name: "tenant_members",
    description: "租户成员与权限角色映射（owner/admin/member/viewer）",
    recordCount: 0,
  },
  {
    name: "tasks",
    description: "Core task records with command and status",
    recordCount: 0,
  },
  {
    name: "agent_runs",
    description: "Agent execution records linked to tasks",
    recordCount: 0,
  },
  {
    name: "lessons",
    description: "Learned insights from task execution with embeddings",
    recordCount: 0,
  },
  {
    name: "intel_signals",
    description: "Intelligence signals with categorical ranking",
    recordCount: 0,
  },
  {
    name: "intel_signal_routes",
    description: "Jinyiwei signal dispatch records linked to CourtOS tasks",
    recordCount: 0,
  },
  {
    name: "intel_evidence_packs",
    description: "Evidence-bound Jinyiwei intelligence pack snapshots",
    recordCount: 0,
  },
  {
    name: "intel_snapshots",
    description: "Jinyiwei 异动雷达上一轮 intel_signals 全量快照，服务 detectChange 对比",
    recordCount: 0,
  },
  {
    name: "intel_source_track_record",
    description: "锦衣卫信源历史可信度（times_cited/times_confirmed → credibilityWeight 加权）",
    recordCount: 0,
  },
  {
    name: "swarm_session_links",
    description: "CourtOS task to external swarm session linkage",
    recordCount: 0,
  },
  {
    name: "decisions",
    description: "Administrative decisions from court proceedings",
    recordCount: 0,
  },
  {
    name: "forecast_scenarios",
    description: "钦天监三情景预测数据（乐观/基准/悲观）",
    recordCount: 0,
  },
  {
    name: "manor_metrics",
    description: "庄园六部实时指标（ministry_key × metric_label → value）",
    recordCount: 0,
  },
  {
    name: "hubu_projects",
    description: "户部投资/建设项目台账（Turso 真实数据）",
    recordCount: 0,
  },
  {
    name: "hubu_summary",
    description: "户部财政摘要单行记录（total_requested / avg_roi / …）",
    recordCount: 0,
  },
  {
    name: "health_profiles",
    description: "太医院健康档案（profile_json 存 HealthProfile 快照）",
    recordCount: 0,
  },
  {
    name: "medical_news",
    description: "太医院医讯条目（category / headline / citations_json）",
    recordCount: 0,
  },
  {
    name: "bingbu_competitors",
    description: "兵部竞品情报（name / threat_level / market_share_pct）",
    recordCount: 0,
  },
  {
    name: "bingbu_swot",
    description: "兵部 SWOT 分析快照（单行）",
    recordCount: 0,
  },
  {
    name: "bingbu_recommendations",
    description: "兵部战略建议（type / priority / citations_json）",
    recordCount: 0,
  },
  {
    name: "shangshufang_im_messages",
    description: "上书房 IM 聊天记录（用户会话、角色、正文、时间）",
    recordCount: 0,
  },
  {
    name: "ima_knowledge_documents",
    description: "IMA knowledge documents uploaded from Shangshufang evidence attachments",
    recordCount: 0,
  },
  {
    name: "decision_tasks",
    description: "CourtOS MVP 决策任务主表（统一朝堂 Loop 状态）",
    recordCount: 0,
  },
  {
    name: "draft_edicts",
    description: "上书房拟旨记录（DraftEdictV1 payload）",
    recordCount: 0,
  },
  {
    name: "court_reviews",
    description: "军机处会审记录（ReviewPlanV1 payload）",
    recordCount: 0,
  },
  {
    name: "department_review_runs",
    description: "部门参审运行记录（DepartmentOpinionV1 payload）",
    recordCount: 0,
  },
  {
    name: "memorials",
    description: "奏折记录（MemorialV1 payload）",
    recordCount: 0,
  },
  {
    name: "emperor_decisions",
    description: "用户裁决记录（EmperorDecisionV1 payload）",
    recordCount: 0,
  },
  {
    name: "shiguan_archives",
    description: "史馆归档记录（ShiguanArchiveRecordV1 payload）",
    recordCount: 0,
  },
  {
    name: "court_loop_runs",
    description: "统一朝堂 Loop 执行记录",
    recordCount: 0,
  },
  {
    name: "court_issues",
    description: "Finance-intel loop issues raised from Shangshufang",
    recordCount: 0,
  },
  {
    name: "department_memorials",
    description: "Department memorials generated from live swarm outputs",
    recordCount: 0,
  },
  {
    name: "decision_briefs",
    description: "Shangshufang decision briefs awaiting authorized decision",
    recordCount: 0,
  },
  {
    name: "imperial_instructions",
    description: "Authorized decree/evidence/review/reject instructions",
    recordCount: 0,
  },
  {
    name: "execution_runs",
    description: "Execution records for authorized instructions",
    recordCount: 0,
  },
  {
    name: "archive_records",
    description: "End-to-end archive records for finance-intel loop",
    recordCount: 0,
  },
];
