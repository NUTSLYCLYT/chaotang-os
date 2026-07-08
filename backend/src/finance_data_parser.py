"""户部 · 金蝶/审计报表 Excel 解析器（确定性抽取,带来源单元格）

吃出纳从金蝶导出的 Excel(资产负债表/利润表/应收账款明细),
解析成结构化 dict,每个数字标来源(sheet+行),交给 finance_validators 校验、
再交蜂群分析。**解析层不做任何算术、不做判断**,只把纸上的数字搬成结构化。

支持 .xls(xlrd)与 .xlsx(openpyxl)。金蝶各版本导出列序略有差异,
故用"标签模糊扫描 + 列名映射"而非写死坐标,容版本差异。

只读源文件,绝不修改;数据全程本机。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class ParsedField:
    """一个被抽取的字段 + 来源(可溯源,满足'每数可溯源'铁律)。"""

    value: float | None
    source: str  # 如 "资产负债表!R12"


@dataclass
class ParsedStatements:
    period: str
    fields: dict[str, ParsedField] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def plain(self) -> dict:
        """给 finance_validators 用的纯值 dict。"""
        return {k: v.value for k, v in self.fields.items()}

    def provenance(self) -> dict:
        return {k: v.source for k, v in self.fields.items()}


# ─── 通用表格读取(屏蔽 xls/xlsx 差异) ──────────────────────────


def _load_rows(path: str) -> dict[str, list[list]]:
    """返回 {sheet_name: [[cell,...],...]},单元格为原始值。"""
    ext = os.path.splitext(path)[1].lower()
    sheets: dict[str, list[list]] = {}
    if ext == ".xls":
        import xlrd

        wb = xlrd.open_workbook(path)
        for sh in wb.sheets():
            sheets[sh.name] = [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]
    elif ext in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook

        wb = load_workbook(path, read_only=True, data_only=True)
        for sh in wb.worksheets:
            sheets[sh.title] = [[c if c is not None else "" for c in row] for row in sh.iter_rows(values_only=True)]
    else:
        raise ValueError(f"不支持的格式: {ext}(只认 .xls/.xlsx)")
    return sheets


def _num(v) -> float | None:
    try:
        s = str(v).replace(",", "").replace("元", "").strip()
        return float(s) if s not in ("", "-") else None
    except (ValueError, TypeError):
        return None


def _find_in_sheet(rows: list[list], label_key: str, label_cols=(0, 1, 4), val_cols=(2, 3, 5, 6)) -> ParsedField | None:
    """在某 sheet 找含 label_key 的行,取同行右侧第一个数值单元格。"""
    for ri, row in enumerate(rows):
        for lc in label_cols:
            if lc < len(row):
                lab = str(row[lc]).replace(" ", "")
                if label_key in lab:
                    for vc in val_cols:
                        if vc < len(row):
                            n = _num(row[vc])
                            if n is not None:
                                return ParsedField(n, f"R{ri + 1}C{vc + 1}")
    return None


def _pick_sheet(sheets: dict, *keys: str) -> tuple[str, list[list]] | None:
    for name, rows in sheets.items():
        nm = name.replace(" ", "")
        if any(k in nm for k in keys):
            return name, rows
    return None


# ─── 三表抽取 ────────────────────────────────────────────────


def parse_statements(path: str, period: str = "") -> ParsedStatements:
    """解析含 资产负债表 + 利润表 的工作簿(审计报表 / 金蝶导出通用)。"""
    sheets = _load_rows(path)
    out = ParsedStatements(period=period or os.path.basename(path))

    bs = _pick_sheet(sheets, "资产负债")
    pl = _pick_sheet(sheets, "利润", "损益")
    if bs is None:
        out.warnings.append("未找到资产负债表 sheet")
    if pl is None:
        out.warnings.append("未找到利润表/损益表 sheet")

    if bs:
        name, rows = bs
        # 资产负债表两侧列序固定(审计/金蝶通用):
        #   资产侧 标签col0(/1)、期末值col2(/3);负债权益侧 标签col4、期末值col6(/7、/5)
        ASSET_SIDE = [("货币资金", "货币资金"), ("应收账款", "应收账款"), ("存货", "存货"), ("资产总计", "资产总计")]
        LIAB_SIDE = [("负债合计", "负债合计"), ("未分配利润", "未分配利润")]
        for key, label in ASSET_SIDE:
            pf = _find_in_sheet(rows, label, label_cols=(0, 1), val_cols=(2, 3))
            if pf:
                pf.source = f"{name}!{pf.source}"
                out.fields[key] = pf
        for key, label in LIAB_SIDE:
            pf = _find_in_sheet(rows, label, label_cols=(4, 5), val_cols=(6, 7)) or _find_in_sheet(
                rows, label
            )  # 兜底:版面异常时放宽
            if pf:
                pf.source = f"{name}!{pf.source}"
                out.fields[key] = pf
        # 所有者权益:标签常带全角括号,同时含'权益'与'合计'
        for ri, row in enumerate(rows):
            for lc in (4, 0, 1):
                if lc < len(row):
                    lab = str(row[lc]).replace(" ", "")
                    if "权益" in lab and "合计" in lab and "负债和" not in lab:
                        for vc in (6, 5, 3, 2):
                            if vc < len(row) and _num(row[vc]) is not None:
                                out.fields["所有者权益"] = ParsedField(_num(row[vc]), f"{name}!R{ri + 1}C{vc + 1}")
                                break
                    if "所有者权益" in out.fields:
                        break
            if "所有者权益" in out.fields:
                break

    if pl:
        name, rows = pl
        for key, label in [
            ("营业收入", "营业收入"),
            ("营业成本", "营业成本"),
            ("利润总额", "利润总额"),
            ("净利润", "净利润"),
        ]:
            pf = _find_in_sheet(rows, label)
            if pf:
                pf.source = f"{name}!{pf.source}"
                out.fields[key] = pf

    return out


# ─── 应收账款明细抽取(金蝶"客户往来/应收明细"导出) ─────────────

# 金蝶各版本表头叫法不一,做模糊映射
_AR_HEADERS = {
    "客户": ["客户", "往来单位", "核算项目", "客户名称", "单位名称"],
    "单据日期": ["单据日期", "业务日期", "日期", "开票日期", "制单日期"],
    "应收金额": ["应收金额", "借方", "本期借方", "发生额", "合同金额", "金额"],
    "已回款": ["已收", "贷方", "本期贷方", "收款", "已回款"],
    "未回款": ["余额", "期末余额", "未收", "未回款", "应收余额"],
    "单号": ["单据编号", "凭证号", "合同号", "单号"],
}


def _match_header(cell: str) -> str | None:
    c = str(cell).replace(" ", "")
    for canon, alts in _AR_HEADERS.items():
        if any(a in c for a in alts):
            return canon
    return None


def parse_ar_detail(path: str, sheet_hint: str = "") -> list[dict]:
    """解析应收账款明细 → [{客户,单据日期,应收金额,已回款,未回款,单号}]。

    单据日期解析成 datetime.date(供账龄计算);解析不了则为 None。
    """
    from datetime import datetime, date

    sheets = _load_rows(path)
    chosen = None
    if sheet_hint:
        picked = _pick_sheet(sheets, sheet_hint)
        chosen = picked[1] if picked else None
    if chosen is None:
        picked = _pick_sheet(sheets, "应收", "往来", "明细")
        chosen = picked[1] if picked else next(iter(sheets.values()), [])

    # 找表头行:含至少 2 个可识别表头的行
    header_row, colmap = None, {}
    for ri, row in enumerate(chosen[:15]):
        m = {}
        for ci, cell in enumerate(row):
            canon = _match_header(cell)
            if canon and canon not in m:
                m[canon] = ci
        if len(m) >= 2 and "客户" in m:
            header_row, colmap = ri, m
            break
    if header_row is None:
        return []

    def to_date(v):
        if isinstance(v, (datetime, date)):
            return v.date() if isinstance(v, datetime) else v
        s = str(v).strip().replace("/", "-").replace(".", "-")
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m"):
            try:
                return datetime.strptime(s[: len(fmt) + 4], fmt).date()
            except (ValueError, TypeError):
                continue
        return None

    items = []
    for row in chosen[header_row + 1 :]:

        def g(k):
            ci = colmap.get(k)
            return row[ci] if (ci is not None and ci < len(row)) else ""

        cust = str(g("客户")).strip()
        if not cust or "合计" in cust or "小计" in cust:
            continue
        amt, paid, bal = _num(g("应收金额")), _num(g("已回款")), _num(g("未回款"))
        if amt is None and bal is None:
            continue
        items.append(
            {
                "客户": cust,
                "单号": str(g("单号")).strip(),
                "开票日": to_date(g("单据日期")),
                # 优先用"余额"当未回;否则用 应收-已回
                "应收金额": amt if amt is not None else (bal or 0),
                "已回款": paid if (paid is not None and amt is not None) else 0,
                "备注": "" if amt is not None else "(取自余额列)",
            }
        )
    return items
