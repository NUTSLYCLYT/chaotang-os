# Task 2: 登记确认范围的能力映射

Allowed paths: `backend/app/agents/bureaus/capabilities.py`, `backend/tests/test_bureau_capabilities.py`.

Populate `CAPABILITY_PROFILES` with exactly these IDs and `(department, bureau)` bindings: `lead_acquisition`(兵部,线索司), `commercial_opportunity`(兵部,报价司), `financial_analysis`(户部,会计司), `quotation_analysis`(户部,盐铁司), `contract_review`(刑部,合同司), `legal_compliance`(刑部,合规稽查司), `product_planning` and `trend_simulation`(工部,产研司), `sourcing`(工部,物料司), `pack_rd`, `hardware_design`, `sdlc_advisory`, `code_review_advisory`(工部,技术司), `battery_stage_gate`(工部,质量司), `process_manufacturing`(工部,现场司), `delivery_aftercare`(工部,承诺司), `brand_strategy`(礼部,品牌司), `content_quality`(礼部,内容司), `social_content_operations`(礼部,客户沟通司), `persona_screening`(吏部,招聘司).

Every profile uses `source_label="dev swarm migration"`, has nonempty purpose/deliverables/guardrails, and clearly constrains irreversible topics (quote, contract, payment, signing, publication, deployment, recruitment, external commitments) to advice/draft/pending approval. `trend_simulation` is scenario/risk only, never a factual prediction. Do not add or import court, jinyiwei, tianjian, shiguan_archive, ai_ops, storage_aftercare, scheduling, persistence, APIs, models or network code.

TDD: first add focused mapping/negative-ID tests and run `cd backend; .venv\Scripts\python.exe -m pytest tests/test_bureau_capabilities.py -q` to observe RED. Then minimally implement, run GREEN and Ruff. No Git writes; preserve unrelated changes. Write report `docs/superpowers/sdd/dev-swarm-task-2-report.md` including RED/GREEN evidence, files, self-review and concerns; return status + one-line test summary + report path.
