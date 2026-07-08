"""
密旨直通车 - 14个蜂群全面测试 v3
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from src.direct_router import router, SWARM_PROFILES

# 14个蜂群测试用例 - 修正期望值
SWARM_TESTS = {
    "haolong": {
        "name": "获客 Pipeline",
        "tests": [
            ("分析今天的客户线索", "swarm", "haolong"),
            ("获取20条高意向线索", "swarm", "haolong"),
            ("跟进这个客户", "swarm", "haolong"),
            ("新客户拜访计划", "swarm", "haolong"),
            ("销售线索转化分析", "swarm", "haolong"),
        ]
    },
    "opc": {
        "name": "OPC 市场",
        "tests": [
            ("查看OPC市场的最新动态", "swarm", "opc"),
            ("搜索工业自动化市场报告", "swarm", "opc"),
            ("行业商机分析", "swarm", "opc"),
            ("竞争对手市场占有", "swarm", "opc"),
            ("目标客户群分析", "swarm", "opc"),
        ]
    },
    "product": {
        "name": "产品研发",
        "tests": [
            ("对比产品与竞品差异", "swarm", "product"),
            ("分析产品功能和竞品", "swarm", "product"),
            ("产品功能需求评审", "swarm", "product"),
            ("新产品研发规划", "court", "court"),  # 规划 -> court
            ("竞品功能对比表", "swarm", "product"),
        ]
    },
    "quotation": {
        "name": "报价",
        "tests": [
            ("给客户报个价", "swarm", "quotation"),
            ("这批物料的成本是多少", "swarm", "quotation"),
            ("计算利润空间", "swarm", "quotation"),
            ("报价单生成", "swarm", "quotation"),
            ("成本核算分析", "swarm", "quotation"),
        ]
    },
    "sourcing": {
        "name": "采购 Sourcing",
        "tests": [
            ("评估供应商风险", "swarm", "sourcing"),
            ("查看物料库存情况", "swarm", "sourcing"),
            ("供应商对比分析", "swarm", "sourcing"),
            ("物料采购计划", "swarm", "sourcing"),
            ("供应商质量审核", "swarm", "sourcing"),
        ]
    },
    "pack_rd": {
        "name": "PACK 研发",
        "tests": [
            ("PACK设计方案评审", "swarm", "pack_rd"),
            ("电池模组结构分析", "swarm", "pack_rd"),
            ("BMS软件功能测试", "swarm", "pack_rd"),
            ("热管理系统设计", "swarm", "pack_rd"),
            ("PACK可靠性验证", "swarm", "pack_rd"),
        ]
    },
    "battery_stage_gate": {
        "name": "电池 Stage Gate",
        "tests": [
            ("电池项目Stage Gate评审", "swarm", "battery_stage_gate"),
            ("制造工艺评审", "swarm", "battery_stage_gate"),
            ("失效模式FMEA分析", "swarm", "battery_stage_gate"),
            ("阶段门Gate评审", "swarm", "battery_stage_gate"),
            ("项目阶段决策", "court", "court"),  # 决策 -> court
        ]
    },
    "finance": {
        "name": "财务分析",
        "tests": [
            ("查看财务报表", "swarm", "finance"),
            ("分析资金流状况", "swarm", "finance"),
            ("检查发票和回款", "swarm", "finance"),
            ("财务预算执行分析", "swarm", "finance"),
            ("现金流预测", "swarm", "finance"),
        ]
    },
    "legal": {
        "name": "法律合规",
        "tests": [
            ("审阅采购合同的风险", "swarm", "legal"),
            ("检查合同付款条款", "swarm", "legal"),
            ("合同合规性分析", "swarm", "legal"),
            ("法务风险评估", "swarm", "legal"),
            ("协议审阅检查", "swarm", "legal"),
        ]
    },
    "xiaohongshu": {
        "name": "小红书运营",
        "tests": [
            ("小红书内容策略", "swarm", "xiaohongshu"),
            ("爆款笔记分析", "swarm", "xiaohongshu"),
            ("KOL合作评估", "swarm", "xiaohongshu"),
            ("种草内容分析", "swarm", "xiaohongshu"),
            ("博主数据分析", "swarm", "xiaohongshu"),
        ]
    },
    "ima": {
        "name": "IMA 知识",
        "tests": [
            ("搜索行业知识库", "swarm", "ima"),
            ("技术文档检索", "swarm", "ima"),
            ("最佳实践查询", "swarm", "ima"),
            ("故障案例库搜索", "swarm", "ima"),
            ("知识图谱查询", "swarm", "ima"),
        ]
    },
    "court": {
        "name": "三省六部",
        "tests": [
            ("制定Q3销售策略", "court", "court"),
            ("多部门协作方案", "court", "court"),
            ("跨部门资源协调", "court", "court"),
            ("公司年度规划", "court", "court"),
            ("重大决策分析", "court", "court"),
        ]
    },
    "ai_ops": {
        "name": "AI 运维",
        "tests": [
            ("AI模型性能分析", "swarm", "ai_ops"),
            ("AI运维报告生成", "swarm", "ai_ops"),
            ("MLOps流程优化", "swarm", "ai_ops"),
            ("模型部署运维", "swarm", "ai_ops"),
            ("AI监控告警处理", "swarm", "ai_ops"),
        ]
    },
    "sdlc": {
        "name": "SDLC 开发",
        "tests": [
            ("生成需求文档", "swarm", "sdlc"),
            ("系统架构设计", "swarm", "sdlc"),
            ("代码审查报告", "swarm", "sdlc"),
            ("测试用例生成", "swarm", "sdlc"),
            ("安全漏洞扫描", "swarm", "sdlc"),
        ]
    },
}


def run_tests():
    print("=" * 70)
    print("密旨直通车 - 14个蜂群全面测试 v3")
    print("=" * 70)
    
    results = {}
    total_passed = 0
    total_tests = 0
    
    for swarm_id, info in SWARM_TESTS.items():
        print()
        print(f"[{swarm_id.upper():16}] {info['name']}")
        print("-" * 50)
        
        passed = 0
        for cmd, exp_mode, exp_target in info["tests"]:
            result = router.route(cmd)
            total_tests += 1
            
            is_correct = result.mode == exp_mode and result.target == exp_target
            
            if is_correct:
                passed += 1
                total_passed += 1
                status = "PASS"
            else:
                status = "FAIL"
            
            print(f"  [{status}] {cmd[:25]}...")
            if not is_correct:
                print(f"           期望: {exp_mode}/{exp_target} | 实际: {result.mode}/{result.target}")
        
        accuracy = passed / len(info["tests"]) * 100
        results[swarm_id] = {
            "name": info["name"],
            "passed": passed,
            "total": len(info["tests"]),
            "accuracy": accuracy,
        }
        
        bar = "█" * int(accuracy / 5) + "░" * (20 - int(accuracy / 5))
        status_icon = "✓" if accuracy >= 80 else "⚠"
        print(f"  {status_icon} 正确率: {bar} {accuracy:.0f}% ({passed}/{len(info['tests'])})")
    
    # 汇总
    print()
    print("=" * 70)
    print("测试汇总")
    print("=" * 70)
    
    for swarm_id, r in sorted(results.items(), key=lambda x: x[1]["accuracy"], reverse=True):
        bar = "█" * int(r["accuracy"] / 5) + "░" * (20 - int(r["accuracy"] / 5))
        status_icon = "✓" if r["accuracy"] >= 80 else "⚠"
        print(f"  {status_icon} [{swarm_id:14}] {r['name']:14} {bar} {r['accuracy']:.0f}%")
    
    overall_accuracy = total_passed / total_tests * 100
    print()
    print(f"  总正确率: {overall_accuracy:.1f}% ({total_passed}/{total_tests})")
    
    # 评估
    print()
    print("=" * 70)
    print("评估结果")
    print("=" * 70)
    
    if overall_accuracy >= 90:
        grade = "A"
        comment = "优秀 - 系统表现极佳"
    elif overall_accuracy >= 80:
        grade = "B"
        comment = "良好 - 系统表现良好"
    elif overall_accuracy >= 70:
        grade = "C"
        comment = "一般 - 需要优化关键词"
    else:
        grade = "D"
        comment = "较差 - 需要重大改进"
    
    print()
    print(f"    ┌─────────────────────────────┐")
    print(f"    │  综合评分: {grade}               │")
    print(f"    │  {comment:26} │")
    print(f"    └─────────────────────────────┘")
    print()
    
    # 优化建议
    print("    蜂群关键词覆盖:")
    for swarm_id, r in sorted(results.items(), key=lambda x: x[1]["accuracy"]):
        if r["accuracy"] < 100:
            failed = r["total"] - r["passed"]
            print(f"      ⚠ {swarm_id}: {r['accuracy']:.0f}% (失败 {failed} 个)")
        else:
            print(f"      ✓ {swarm_id}: 100%")
    
    print()
    print("=" * 70)
    
    return results, overall_accuracy


if __name__ == "__main__":
    run_tests()