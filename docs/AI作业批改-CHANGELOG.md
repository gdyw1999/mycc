# 更新日志 (Changelog)

本文档记录作业批改描红中台的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [V2.11] - 2026-03-08

### 新增

#### 数学作业 v0.7 多模态批改模式

**功能概述**：
- 扩展 v0.7 多模态架构到数学作业批改
- 使用 Qwen3.5-VL 直接识别数学试卷，跳过 OCR 阶段
- 与语文作业共享统一的处理流程和提示词系统

**核心特性**：
- **多图片支持**：完整试卷可一次上传所有页面（11、12、13、14.jpg 等）
- **智能试卷还原**：精确还原数学题目格式（填空题、竖式计算、应用题、几何题等）
- **深度学情分析**：自动生成错误分析、能力评估、学习建议
- **统一输出格式**：HTML + JSON 双文件，与语文作业保持一致

**提示词模板**：
- 文件：`internal/llm/prompts/math_homework_v1.0.md`
- 包含完整的数学试卷还原和批改规范
- 支持1500+行的 CSS 样式库
- 支持多种题型：填空题、计算题、应用题、几何题、趣味题型

**API 使用示例**：
```python
# 单张图片
POST /correct
{
  "images": ["base64_data"],
  "subject": "math_homework"
}

# 多张图片（完整试卷）
POST /correct
{
  "images": ["base64_1", "base64_2", "base64_3", "base64_4"],
  "subject": "math_homework"
}
```

**配置示例**（config.yaml）：
```yaml
correction:
  subjects:
    math_homework:
      name: "数学作业批改"
      enabled: true
      mode: "v07"
      vl:
        provider: "ali"
        model: "qwen3.5-plus-2026-02-15"
      output_dir: "outputs"
      enable_correction: true
      prompt_template: "internal/llm/prompts/math_homework_v1.0.md"
```

#### 分学科处理器架构

**设计改进**：
- 为语文和数学作业创建独立的处理器，避免配置冲突
- **V07LanguageProcessor** (`internal/llm/v07_language_processor.py`):
  - 语文作业专用处理器
  - 保留 LLM 生成的评价区域（语文作业 LLM 还原效果较好）
  - 仅处理日期占位符和教师名称替换
- **V07MathProcessor** (`internal/llm/v07_math_processor.py`):
  - 数学作业专用处理器
  - 移除 LLM 生成的评价区域
  - 添加统一的学情分析区域（带 inline style 标识）

**实现细节**：
- 使用 inline style 属性区分两种处理器生成的评价区域
- V07MathProcessor 生成的区域有 `style="..."` 属性
- LLM 生成的区域无 style 属性，便于识别和移除

**homework_api.py 更新**：
- 根据 `subject` 参数动态选择对应的处理器
- `language_homework` → `V07LanguageProcessor`
- `math_homework` → `V07MathProcessor`

#### V07Processor 增强

**功能优化**：
- **LLM 评价区域移除**：自动检测并移除 LLM 生成的评价区域，避免与 V07MathProcessor 生成的学情分析重复
- **日期占位符全面替换**：支持多种日期占位符格式（202X-XX-XX、2024-12-XX 等）
- **异常格式修复**：修复 "P26-03-XX" 等异常日期格式

**修复问题**：
- 修复页脚显示 "P26-03-08" 的问题，现在正确显示 "批改时间：2026-03-08"
- 优化正则表达式匹配逻辑，更可靠地处理各种日期占位符

#### 批量测试工具

**新增文件**：`tests/test_math_batch.py`
- 支持一次性批改多张图片组成的完整试卷
- 提供详细的测试日志和性能统计

**测试结果**：
- 4张图片（11、12、13、14.jpg）成功处理
- 处理时间：约168秒（2.8分钟）
- 生成文件：45KB，861行 HTML

### 修改

#### homework_api.py

- v0.7 模式检测扩展到 `math_homework` 学科
- 多图片处理逻辑验证（无需修改，原有逻辑已支持）

#### CLAUDE.md

- 更新数学作业批改模式说明
- 添加 v0.7 多模态模式使用指南

---

## [V2.10] - 2026-02-28

### 新增

#### v0.7 多模态语文作业批改模式

**背景**：
- v0.6 使用 OCR + Qwen3.5 两阶段批改流程
- v0.7 直接使用 Qwen3.5-VL 多模态模型，跳过 OCR 阶段
- 更快的处理速度，更统一的 API 接口

**核心特性**：
- **直接图像识别**：Qwen3.5-VL 原生多模态支持，无需单独 OCR 调用
- **OCR 校正表保留**：作为最终校正层，确保识别准确性
- **统一 API 路由**：通过 `subject=language_homework` 参数区分模式，无需额外端点
- **HTML + JSON 双输出**：同时生成美观 HTML 报告和结构化 JSON 数据

**API 路由架构**：
```
POST /correct
  ├─ subject=language_homework → v0.7 模式（Qwen3.5-VL 直接识别）
  ├─ subject=essay_composition → v2.0 模式（HunyuanOCR + LLM）
  └─ subject=math_homework → 未来扩展（复用 v0.7 架构）
```

#### V07Processor 响应处理器

**文件**：`internal/llm/v07_processor.py`

**功能**：
- **日期注入**：自动将当前日期注入到 JSON 和 HTML 中
- **教师名称固定**：统一使用 "LinkAi 智慧助教"
- **文件命名优化**：
  - 格式：`{班级}_{姓名}_{YYYYMMDD_HHMMSS}_p1.html`
  - 精确到秒的时间戳，避免同一天文件冲突
  - 自动处理空标题情况，避免双下划线
- **HTML 后处理**：
  - 替换 `2023-09-XX` 占位符为当前日期
  - 使用正则表达式替换 AI 生成的教师名称
- **JSON 清洗**：移除 markdown 代码块标记

#### 配置系统扩展

**文件**：`config.py`

**新增 SubjectConfig 字段**：
```python
@dataclass
class SubjectConfig:
    # v0.7 多模态批改特有配置
    mode: str = "legacy"              # 模式：legacy/v07
    vl_provider: str = "ali"          # VL 模型提供商
    vl_model: str = "qwen3.5-plus-2026-02-15"
    vl_timeout: int = 180
    vl_max_retries: int = 2
    vl_temperature: float = 0.3
    vl_max_tokens: int = 16384
    output_dir: str = "outputs"       # 输出目录（非 v07 子目录）
    enable_correction: bool = True    # 是否启用 OCR 校正表
    school_name: str = ""             # 学校名称
```

#### 提示词模板更新

**文件**：`internal/llm/prompts/qwen35_v0.7.md`

**改进**：
- **明确 JSON 格式**：添加完整的 JSON 结构示例
- **字段映射规范**：明确使用 `student_info` 而非 `exam_meta`
- **双输出格式**：同时要求 HTML 报告和 JSON 数据
- **占位符替换**：支持 `2023-09-XX` 日期占位符

### 变更

#### homework_api.py 路由重构

**优先级路由逻辑**：
```python
# 1. v0.7 模式检查（最高优先级）
is_v07_mode = (
    subject == 'language_homework' and
    subject_config and
    getattr(subject_config, 'mode', None) == 'v07'
)

# 2. 作业批改模式
elif subject in ['language_homework', 'math_homework', 'english']:
    return _handle_homework_correction(...)

# 3. 默认作文批改模式
else:
    return _handle_essay_correction(...)
```

#### config.yaml 配置更新

**新增 language_homework v0.7 配置**：
```yaml
correction:
  subjects:
    language_homework:
      name: "语文作业批改"
      mode: "v07"                      # v0.7 多模态模式
      vl:
        provider: "ali"
        model: "qwen3.5-plus-2026-02-15"
        timeout: 180
        max_retries: 2
        temperature: 0.3
        max_tokens: 16384
      prompt_template: "internal/llm/prompts/qwen35_v0.7.md"
      output_dir: "outputs"            # 直接输出到 outputs
      enable_correction: true          # 启用 OCR 校正表
      school_name: ""
      enabled: true
```

### 修复

#### 文件命名问题

**问题 1**：双下划线（空标题时）
- 原因：`{title}` 为空时仍添加下划线分隔符
- 修复：条件判断，跳过空标题

**问题 2**：输出目录错误
- 原因：代码硬编码 `outputs/v07`
- 修复：读取配置的 `output_dir` 字段

#### 日期和教师名称问题

**问题**：HTML 中显示 `2023-09-XX` 和 AI 生成的教师名称
- 修复：
  - 自动注入当前日期到 JSON 和 HTML
  - 使用正则表达式替换教师名称为固定值

```python
# 日期注入
current_date = datetime.now().strftime("%Y-%m-%d")
student_info["date"] = current_date
llm_html = llm_html.replace("2023-09-XX", current_date)

# 教师名称固定
llm_html = re.sub(
    r'批改教师[：:]\s*[\u4e00-\u9fa5A-Za-z0-9\s]+(?=\s*[|<])',
    '批改教师：LinkAi 智慧助教',
    llm_html
)
```

#### JSON 格式不匹配

**问题**：VL 模型返回 `exam_meta.student_name` 而非 `student_info.name`
- 修复：在提示词模板中明确 JSON 结构，强调使用 `student_info`

### 保留

#### 遗留文件保留

保留以下文件供未来 `math_homework` 和 `english_homework` 使用：
- `internal/orchestration/tsc_orchestrator.py`
- `internal/llm/models_homework.py`
- `internal/orchestration/qwen_ocr_combiner.py`
- `internal/rendering/language_renderer.py`
- `internal/llm/models/tsc_response.py`

**未来规划**：
- `math_homework` 和 `english_homework` 可能使用 v0.7 架构 + 不同提示词
- 也可能测试 OCR + Qwen3.5 对比效果后选择最佳方案

### 相关文件

**新增**：
- `internal/llm/v07_processor.py` (~400 行) - v0.7 响应处理器
- `internal/llm/vl_llm_client.py` (~300 行) - VL 模型客户端
- `internal/llm/prompts/qwen35_v0.7.md` - v0.7 提示词模板
- `tests/test_qwen35_v07.py` (~300 行) - v0.7 测试文件

**修改**：
- `config.py` - SubjectConfig 扩展 v0.7 字段
- `config.yaml` - 新增 language_homework v0.7 配置
- `homework_api.py` - 路由优先级重构
- `internal/orchestration/__init__.py` - 导出更新

---

## [V2.09] - 2026-02-17

### 新增

#### 美观 HTML 渲染器
- 新增 `HomeworkHtmlRenderer`，生成美观的语文作业批改 HTML 报告
- 渐变背景设计（紫色渐变）
- 信息栏显示班级、姓名、单元、得分（移除日期显示）
- 控制按钮：显示全部、只看错误、只看正确、只看优秀
- 标记框悬停显示详情弹窗
- 统计卡片：正确题目、错误题目、优秀答案、正确率
- 错题纠正列表（红色渐变背景）
- 优秀答案列表（金色渐变背景）
- 教师总评区域
- 动画效果：标记淡入、错误脉冲、悬停放大

#### TSC 格式提示词
- 新增 `language_homework_v3.0.md` 提示词（基于 tsc.txt）
- 结构化 JSON 输出格式：
  - 基本信息（班级、姓名、日期、单元/课题、试卷名称）
  - 题目详情（题号、大题号、题型、题目内容、学生答案、判定）
  - 错误列表（题号、大题号、错误类型、原文、正确答案、批注）
  - 佳句（原文、出处、批注）
  - 总评（得分、正确率、优点、需改进、教师评语）
- 新增 `TSCResponse` 数据模型及转换方法

#### Qwen3.5 + PaddleOCR 坐标组合
- 新增 `test_qwen_ocr_html_generation.py` 测试文件
- Qwen3.5 智能批改 + PaddleOCR 精确坐标组合
- 多策略匹配：精确匹配、包含匹配、模糊匹配、上下文推断
- 自动选择最大面积坐标，避免匹配标点符号
- 43个正确词语单独框选显示
- 2个错误词语（记速、严夏）单独标注

### 变更

#### 配置更新
- 语文作业批改切换到 `qwen3.5-plus-2026-02-15`（原生多模态支持）
- 提示词模板更新为 `language_homework_v3.0.md`
- 移除日期显示（HTML 信息栏优化）

#### 文件清理
- 移除过时测试文件（test_paddleocr_flow.py、test_qwen3vl_*.py 等）
- 移除临时脚本（start.sh、stop.sh）
- 移除临时测试文件（tests/1.md 等）

### 技术细节

#### 标记框统计（测试结果）
- 正确框：50 个（43个看拼音写词语 + 7个其他正确题目）
- 错误框：2 个（记速→继续、严夏→炎夏）
- 优秀框：2 个（慢镜头聚焦、鼻子一酸）
- 总计：54 个标记框

#### 坐标匹配改进
- 精确匹配早期退出（10× 性能提升）
- 高分阈值提前终止（2× 性能提升）
- 面积过滤（>1000 像素²）避免标点符号
- 多策略收集后选择最大面积坐标

---

## [V2.08] - 2026-02-14

### 新增

#### 坐标映射性能优化 v2.8

**背景**：坐标映射是多页作文批改的核心模块，需要平衡性能和准确度。

**问题分析**：
1. **失败批注静默跳过**：映射失败的批注被静默跳过，用户无法感知批改不完整
2. **阈值硬编码**：全局搜索阈值 0.7 硬编码在代码中，无法根据场景调整
3. **日志不完整**：映射失败时缺少详细的上下文信息（页码、分数、匹配方法）
4. **性能瓶颈**：多页作文（10页）场景下，全局搜索耗时较长（~530ms）

**改进清单**：

| 优先级 | 改进点 | 状态 | 性能提升 |
|--------|--------|------|---------|
| P0 | 失败批注记录（用户可见） | ✅ 完成 | - |
| P0 | 阈值可配置（灵活性） | ✅ 完成 | - |
| P0 | 详细日志（调试友好） | ✅ 完成 | - |
| P1 | 精确匹配早期退出 | ✅ 完成 | **10×** |
| P1 | 高分阈值提前终止 | ✅ 完成 | **2×** |
| P1 | 配置文件支持 | ✅ 完成 | - |
| P2 | 性能基准测试 | ✅ 完成 | 验证通过 |

#### 失败批注记录（用户可见）

**问题**：
- 映射失败的批注被静默跳过
- 用户无法感知批改不完整
- API 响应总返回 `status=success`

**解决方案**：
```python
# 分类记录
final_annotations = []
failed_annotations = []

for r in mapping_results:
    if r.is_mapped():
        final_annotations.append(...)
    else:
        failed_annotations.append({
            "text": r.annotation.text,
            "type": r.annotation.type.value,
            "error_message": r.error_message,
            ...
        })

# 动态状态
if failed_annotations:
    if final_annotations:
        status = "partial_success"  # ✅ 部分成功
    else:
        status = "failure"  # ✅ 全部失败
else:
    status = "success"  # ✅ 全部成功
```

**API 响应示例**：
```json
{
  "status": "partial_success",
  "errors": ["2 个批注映射失败"],
  "correction_details": {
    "failed_annotations": 2,
    "failure_details": [...]
  }
}
```

#### 阈值可配置（灵活性）

**新增配置项**：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `global_search_threshold` | 0.7 | 全局搜索触发阈值 |
| `enable_global_search` | true | 是否启用全局搜索 |
| `global_search_early_stop_threshold` | 0.95 | 高分提前终止阈值 |
| `log_failed_annotations` | true | 是否记录失败批注 |

**配置文件示例**：
```yaml
# config.yaml
ocr:
  mapping:
    global_search_threshold: 0.7
    enable_global_search: true
    early_stop_threshold: 0.95
    log_failed_annotations: true
```

#### 详细日志（调试友好）

**新增日志**：

**初始化日志**：
```
[CoordinateMapper] 初始化完成: 3 页, 150 个文字块
[CoordinateMapper] 配置: 全局搜索阈值=0.7, 高分提前终止=0.95, 启用全局搜索=True
```

**映射失败日志**：
```
[CorrectionOrchestrator] 批注映射失败: text='嘀咕', type=typo, llm_image_index=2, error='页面 2 中所有匹配策略都失败'
[CorrectionOrchestrator] 失败批注详情: {...}
```

#### 性能优化

**优化点 1：精确匹配早期退出**

**原理**：找到精确匹配（score=1.0）时，立即停止搜索剩余页面

**性能提升**：**10×**（最佳情况）

**代码**：
```python
if page_result.match_score >= 1.0:
    logger.info("找到精确匹配！立即停止搜索")
    return page_result
```

**优化点 2：高分阈值提前终止**

**原理**：全局搜索时，如果找到 score >= 0.95 的匹配，提前终止搜索

**性能提升**：**2×**（平均情况）

#### 性能基准测试结果

| 场景 | 页数 | 批注数 | 总耗时 | 平均/批注 |
|------|------|--------|-----------|---------------|
| 单页作文-小规模 | 1 | 5 | 6.34ms | 1.27ms |
| 多页作文-3页-默认 | 3 | 10 | 73.07ms | 7.31ms |
| 多页作文-3页-禁用GS | 3 | 10 | 22.71ms | 2.27ms |
| 多页作文-10页-默认 | 10 | 20 | 529.86ms | 26.49ms |
| 大量批注-50个 | 5 | 50 | 631.75ms | 12.64ms |

**关键发现**：禁用全局搜索性能提升 **15.86×**

#### 配置建议

**默认配置**（推荐）：
```yaml
ocr:
  mapping:
    base_threshold: 0.5
    global_search_threshold: 0.7
    enable_global_search: true
    early_stop_threshold: 0.95
    log_failed_annotations: true
```

**高性能配置**（单页作业）：
```yaml
ocr:
  mapping:
    enable_global_search: false  # 禁用全局搜索
```
**效果**: **15.86× 性能提升**

**高精确度配置**（多页作文）：
```yaml
ocr:
  mapping:
    global_search_threshold: 0.8  # 提高阈值
    early_stop_threshold: 0.98    # 提高终止阈值
```

### 修改文件清单

| 文件 | 修改内容 | 行数 |
|------|---------|------|
| `internal/orchestration/corrector.py` | 添加配置项 + 失败批注处理 + 配置读取 | ~120 行 |
| `internal/mapping/coordinate_mapper.py` | 支持可配置阈值 + 性能优化 + 详细日志 | ~100 行 |
| `config.yaml` | 添加 `ocr.mapping` 配置区域 | ~30 行 |
| `config.py` | 添加 `MappingConfig` 数据类 + 解析逻辑 | ~40 行 |
| `internal/llm/llm_client.py` | 修复语法错误 | ~10 行 |
| `tests/benchmark_coordinate_mapping.py` | 性能基准测试脚本 | ~400 行 |

### 文档输出

| 文档 | 说明 |
|------|------|
| `docs/coordinate-mapping-algorithm.md` | 算法详解（四级匹配策略 + 多页匹配） |
| `docs/coordinate-mapping-improvement.md` | 改进方案（问题分析 + 解决方案） |
| `docs/coordinate-mapping-performance.md` | 性能优化（问题分析 + 优化方案） |
| `docs/coordinate-mapping-changelog.md` | 实施记录（代码改动） |
| `docs/coordinate-mapping-final.md` | 最终总结（本次改进） |
| `docs/coordinate-mapping-config-integration.md` | 配置文件集成报告 |
| `docs/coordinate-mapping-performance-benchmark.md` | 性能基准测试结果 |
| `docs/coordinate-mapping-complete.md` | 完整改进报告 |

### 测试验证

**单元测试**：
```bash
pytest tests/ -v --tb=short
```
**结果**: ✅ **29 个测试通过**

**性能基准测试**：
```bash
python tests/benchmark_coordinate_mapping.py
```
**结果**: ✅ **所有场景测试通过，性能验证成功**

---

## [V2.07] - 2026-02-05

### 新增

#### 拼音识别支持（PaddleOCR 集成）

**背景**：
- 测试发现 PaddleOCR-VL-1.5 和 PP-OCRv5 都支持拼音识别
- HunyuanOCR 暂不支持拼音（对语文作业批改是重大限制）
- 决定重新引入 PaddleOCR 作为语文作业的专用 OCR 引擎

**测试验证**：
- ✅ PaddleOCR-VL-1.5：175 个文字块，包含完整拼音（如 `cì tuì`、`bào kǎo`）
- ✅ PP-OCRv5：同样支持拼音识别
- ❌ HunyuanOCR：无法识别拼音内容

**架构设计**：
```
按学科选择 OCR 引擎：
┌─────────────────┬──────────────────┐
│   学科          │   OCR 引擎        │
├─────────────────┼──────────────────┤
│ language_homework│ PaddleOCR-VL-1.5  │ ← 支持拼音
│ essay_composition │ HunyuanOCR        │ ← 理解能力强
│ math_homework   │ HunyuanOCR        │ ← 公式识别
│ english          │ HunyuanOCR        │ ← 语义理解
└─────────────────┴──────────────────┘
```

#### 作业批注类型扩展

**新增批注类型**（`internal/llm/models.py`）：
- `CORRECT` - 正确（画绿色勾 ✓）
- `WRONG` - 错误（画红色叉 ✗）
- `PARTIAL` - 部分正确（画橙色半勾 ½）

**描红渲染实现**（`internal/rendering/annotation_renderer.py`）：
- `_draw_check_mark()` - 绘制绿色勾号
- `_draw_cross_mark()` - 绘制红色叉号
- `_draw_half_check_mark()` - 绘制半勾 + 圆点

**渲染效果**：
- 勾号大小：根据文本高度自适应（0.8x）
- 叉号覆盖：覆盖整个文字区域（1.2x）
- 半勾标识：勾号 + 圆点组合

#### 作业批改完整支持

**响应类型分离**（`internal/llm/models_homework.py`）：
- `LLMHomeworkResponse`：作业批改专用响应
  - `question_count`：总题数
  - `correct_count`、`wrong_count`、`partial_count`：统计信息
  - `questions`：逐题解析列表
  - `score`：得分（基于正确率计算）
  - `annotations`：批注列表（兼容性字段）

**自动渲染器选择**（`internal/orchestration/corrector.py`）：
- 检测响应类型，自动选择渲染器：
  - `LLMHomeworkResponse` → `LanguageRenderer`（显示逐题解析）
  - `LLMResponse` → `SummaryRenderer`（通用作文批改）

**评语区域显示**：
```
┌─────────────────────────────────────────┐
│ 作业批改                共10题  对4题  错4题  半对2题 │
│ ─────────────────────────────────────────── │
│ 整体评价                                     │
│ 五年级语文基础知识默写单完成情况尚可，形近字... │
│ ─────────────────────────────────────────── │
│ 逐题解析                                     │
│ ✅ 【1-1】形近字组词（cì/tuì/bào/kǎo）          │
│    回答正确，区分清楚。                      │
│ ❌ 【1-3】形近字组词（署/誊/枕）               │
│    1."署"应为"暑"（暑假的暑）                 │
│    2."誊"应为"誉"（誉写的誉）                 │
│ ...                                         │
└─────────────────────────────────────────┘
```

#### 多 OCR 引擎架构

**PaddleOCR 引擎封装**（`internal/ocr/paddleocr_engine.py`）：
- `PaddleOCREngine`：统一封装类
- 支持引擎类型：`paddleocr_vl_1_5`、`pp_ocrv5`
- 支持从本地 JSON 文件加载结果（测试/离线场景）
- 预留在线 API 调用接口

**多引擎管理**（`internal/orchestration/corrector.py`）：
- 初始化时加载所有可用引擎
- 根据学科配置动态选择引擎
- 向后兼容：默认使用 `hunyuan` 引擎

### 配置变更

**新增 OCR 引擎配置**（`config.yaml`）：
```yaml
ocr:
  default_engine: "hunyuan"  # 全局默认引擎

  # HunyuanOCR 配置
  hunyuan:
    vllm_api_url: "http://101.126.93.180:3006/v1"
    api_key: "..."
    ...

  # PaddleOCR-VL-1.5 配置
  paddleocr_vl_1_5:
    api_url: ""
    api_key: ""
    timeout: 60
    ...

  # PP-OCRv5 配置
  pp_ocrv5:
    ...

correction:
  subjects:
    language_homework:
      ocr_engine: "paddleocr_vl_1_5"  # ← 语文作业使用 PaddleOCR
      ...

    essay_composition:
      ocr_engine: "hunyuan"            # ← 作文使用 HunyuanOCR
      ...
```

**SourceModel 枚举扩展**（`internal/models.py`）：
- 新增 `PADDLEOCR_VL_1_5`
- 新增 `PP_OCRV5`
- 保留 `HUNYUAN_OCR`

### 测试

**PaddleOCR 流程测试脚本**（`test_paddleocr_flow.py`）：
- 直接使用 PaddleOCR JSON 结果测试完整批改流程
- 跳过 HunyuanOCR，验证拼音识别效果
- 测试结果：175 个文字块（含拼音）、10 个批注、84 分、逐题解析完整显示

### 修复

#### 坐标类型转换问题
- **问题**：OpenCV `line()` 函数需要整数坐标，但传入的是浮点数
- **修复**：在画勾/叉/半勾方法中添加 `tuple(map(int, coords))` 转换
- **影响**：修复后描红功能正常工作

#### 评语显示不完整
- **问题**：只显示总体评价，没有逐题解析
- **原因**：语文作业使用 `SummaryRenderer`，无法显示 `questions` 字段
- **修复**：添加 `_render_homework_summary()` 方法，使用 `LanguageRenderer`
- **影响**：修复后评语区域显示完整的统计、整体评价和逐题解析

#### 响应类型判断逻辑
- **问题**：`correct_essay()` 总是返回 `LLMResponse`，导致无法识别作业类型
- **修复**：添加学科判断逻辑，`language_homework` 返回 `LLMHomeworkResponse`
- **实现**：
  - `llm_client.py`：添加 `_parse_homework_response()` 方法
  - 解析 `questions`、`question_count`、`correct_count` 等字段
  - 计算得分：`score = 60 + accuracy * 40`（60-100分范围）
  - 生成 `annotations`：从 `questions` 转换为 `Annotation` 列表

### 相关文件

**新增**：
- `internal/ocr/paddleocr_engine.py` (PaddleOCR 引擎封装，~200 行)
- `test_paddleocr_flow.py` (测试脚本，~300 行)

**修改**：
- `config.yaml` (OCR 引擎配置、学科 OCR 配置)
- `internal/models.py` (`SourceModel` 枚举扩展)
- `internal/llm/models.py` (`AnnotationType` 枚举扩展)
- `internal/llm/models_homework.py` (`LLMHomeworkResponse` 字段扩展)
- `internal/llm/llm_client.py` (`_parse_homework_response()` 方法)
- `internal/rendering/annotation_renderer.py` (画勾/叉/半勾方法)
- `internal/orchestration/corrector.py` (多引擎管理、渲染器自动选择)
- `internal/rendering/language_renderer.py` (作业评语渲染)

**删除**：
- 无

---

## [V2.06] - 2026-01-26

### 移除

#### PaddleOCR 生态完全移除

**背景**：项目已全面迁移到 HunyuanOCR vLLM API，PaddleOCR 相关代码已无使用价值。

**删除的内容**：

1. **核心引擎文件** (~900 行代码)
   - `internal/ocr/structure_engine.py` - PP-StructureV3 + PaddleOCR-VL 双引擎实现

2. **配置清理**
   - 删除 `OCRConfig` 未使用字段：
     - `use_gpu` - HunyuanOCR 是 vLLM API，无需客户端 GPU 配置
     - `gpu_id` - 同上
     - `lang` - HunyuanOCR 通过提示词控制语言
     - `quality_min_text_ratio_first` - PaddleOCR 质量检测配置
     - `quality_min_text_ratio_other` - 同上
     - `quality_min_confidence` - 同上
   - 删除环境变量 `GPU_ID` 读取逻辑
   - 删除 PaddleOCR 镜像设置（`HUB_URL`、`DISABLE_MODEL_SOURCE_CHECK`）

3. **数据模型清理**
   - `SourceModel` 枚举删除：
     - `PP_STRUCTURE_V3`
     - `PADDLEOCR_VL`
     - `PADDLE_OCR`
   - 保留 `HUNYUAN_OCR` 作为唯一 OCR 来源

4. **编排器清理** (`internal/orchestration/corrector.py`)
   - 删除 `StructureOCREngine` 导入
   - 删除 `OrchestratorConfig` 未使用字段：
     - `use_gpu`
     - `gpu_id`
     - `ocr_lang`
   - 简化引擎选择逻辑：
     - 移除 PaddleOCR 分支
     - 仅保留 `hunyuan` 和 `hunyuan_mock` 选项
     - 添加明确的错误提示

5. **API 服务清理** (`api.py`)
   - 删除 PaddleOCR 环境变量设置
   - 更新 `OrchestratorConfig` 初始化（移除 PaddleOCR 参数）
   - 更新健康检查接口（`ocr_gpu` → `ocr_engine`）
   - 更新启动打印信息

6. **模块导出更新** (`internal/ocr/__init__.py`)
   - 删除 `StructureOCREngine`、`StructureConfig` 导出
   - 保留 `VLLMHunyuanOCREngine`、`MockHunyuanOCREngine`

7. **测试文件清理**
   - 删除 `tests/test_paddleocr_fix.py`
   - 删除 `tests/test_line_level_ocr.py`

**代码统计**：
- 删除约 900 行代码
- 清理 6 个核心文件
- 删除 2 个测试文件

**影响**：
- ✅ 代码更简洁，维护成本降低
- ✅ 配置更精简，仅保留实际使用的选项
- ✅ 依赖更清晰，完全基于 HunyuanOCR
- ⚠️ 向后兼容性破坏：PaddleOCR 引擎不再可用

### 优化

#### 代码减法与安全审查

**删除的未使用代码**：
- `api.py`: 删除废弃的 `/annotate` 端点
- `internal/middleware/security.py`: 删除未使用的装饰器 `require_api_key`、`require_rate_limit`
- `internal/rendering/annotation_renderer.py`: 删除孤儿的 `_draw_addition_arrow` 方法

**导入优化**：
- `api.py`, `llm_client.py`: 移除重复导入，统一到文件顶部
- 删除 `from urllib.parse import quote, unquote` 等重复导入

**安全修复**：
1. **SSL 验证配置化**
   - 添加 `security.ssl_verify` 配置项（默认 `false`）
   - `save_url_image` 根据配置决定是否验证 SSL
   - 兼容 CDN 证书问题，同时保留启用选项

2. **类型转换安全**
   - 修复 `img_str = str(img_data).strip()` 不安全转换
   - 添加 `isinstance(img_data, bytes)` 检查
   - bytes 类型先 `decode('utf-8')` 再使用

**代码质量**：
- 硬编码 `enable_comments=True` 改为配置读取 `app_config.correction.rendering.enable_comments`

---

## [V2.05] - 2026-01-25

### 新增

#### 提示词优化 V2.0 (`essay_composition_v2.0.md`)

**简化原则**：让 LLM 专注于批改任务，消除冗余的学生信息提取

**V2.0 相比 V1.9 的改进**：
- **删除**：学生信息提取规范（由 TextExtractor 在 Step 2 完成）
- **删除**：要求 LLM 返回 `student_class` 和 `student_name` 字段
- **删除**：要求 LLM 返回 `full_text` 字段
- **保留**：`text` 字段必须与输入文本完全一致的核心约束
- **保留**：批注长度限制（错别字 2-4 字符，佳句 10-25 字符）
- **保留**：image_index 精准匹配要求

**LLM 响应格式简化**：
```json
// V1.9 格式（冗余）
{
  "student_class": "五（1）班",    // ❌ 删除
  "student_name": "张小明",       // ❌ 删除
  "full_text": "...",            // ❌ 删除
  "score": 92,
  "summary": "...",
  "annotations": [...]
}

// V2.0 格式（精简）
{
  "score": 92,                   // ✅ 保留
  "summary": "...",              // ✅ 保留
  "annotations": [...]           // ✅ 保留
}
```

**数据流程优化**：
```
V1.9: OCR → TextExtractor(提取学生信息) → LLM(再次提取?) → 返回学生信息
V2.0: OCR → TextExtractor(提取学生信息) → LLM(专注批改) → 使用输入的学生信息
```

**新增更详细的 HTTP 错误日志**：
- 在 `llm_client.py` 中添加错误详情记录
- HTTP 500 错误会显示完整的错误响应体
- 方便排查 API Key 额度、模型不存在等问题

#### 图像预处理优化 (Stage 1 + Stage 2)

**Stage 1：变换元数据追踪系统**

- **TransformMetadata 数据类**：记录所有图像变换信息
  - `original_size`: 原始图像尺寸
  - `processed_size`: 处理后图像尺寸
  - `scale_ratio`: 缩放比例
  - `crop_offset`: 裁剪偏移量
  - `map_pixel_to_original()`: 处理后坐标 → 原始坐标
  - `map_pixel_from_original()`: 原始坐标 → 处理后坐标

- **ProcessingResult 数据类**：封装处理结果
  - `image`: 处理后的图像
  - `metadata`: 变换元数据

- **normalize_size 提升**：1280 → **2000px**
  - 更好支持高分辨率图片
  - 提升小字识别准确率

**Stage 2：质量检测增强**

1. **红色格线过滤** (`_calculate_text_ratio`)
   - 使用 HSV 颜色空间检测红色像素
   - 红色范围：H=0-10° 或 170-180°
   - 将格线区域设为白色背景后统计文字覆盖率
   - 调试日志：显示被过滤的红色像素比例

2. **清晰度检测增强**
   - 可配置阈值参数：`min_blur_threshold`（默认 8.0）
   - 新增调试日志：显示清晰度值和阈值
   - 失败信息更详细：`图像模糊 (清晰度: 5.2 < 8.0)`

3. **阴影消除（可选）** (`_eliminate_shadow`)
   - 使用大核形态学闭运算估计背景
   - 核大小 = 图像短边 / 15（最小 50x50）
   - 除法归一化：原图 / 背景
   - 可配置开关：`enable_shadow_elimination=False`
   - 适用于光照不均匀的图像

### 相关文件
- `internal/llm/prompts/essay_composition_v2.0.md` (新建：简化版提示词)
- `internal/llm/llm_client.py` (适配 V2.0 响应格式)
- `config.yaml` (切换到 v2.0 提示词)
- `internal/models.py` (TransformMetadata, ProcessingResult)
- `internal/preprocessing/image_preprocessor.py` (全部 Stage 1+2 变更)
- `internal/ocr/structure_engine.py` (适配 ProcessingResult)

---

## [V2.04] - 2026-01-23

### 新增

#### 便签风格评语区域
- **米黄色背景** (245, 243, 235) 替代纯白，更柔和
- **活页孔装饰** 左侧两个圆孔，模拟活页本撕下效果
- **淡淡横格线** 每 50px 一条，类似信纸
- **顶部阴影过渡** 8px 渐变阴影，模拟便签压在作业下
- **可配置开关** `enable_notebook_style=True/False`

#### 动态字号系统
- **根据图片宽度自动缩放** 基准宽度 1500px
- **缩放范围限制** 0.8x - 2.0x，避免过大或过小
- **示例**：2500px 图片 → 字号放大 1.67 倍

### 优化

#### 文本提取增强 (`internal/extraction/text_extractor.py`)
- **姓名提取新增直接匹配模式**：`r'^([\u4e00-\u9fa5]{2,4})$'`
- **班级提取支持不完整格式**：`r'(\d+\)班)'` 匹配 `1)班`、`2)班` 等
- **解决问题**：部分图片只有姓名文本块，无"姓名："标签时也能识别

#### 描红样式优化 (`internal/rendering/annotation_renderer.py`)
- **半圆圈号向上开口**：从 300° 顺时针到 240°
- **手写不规则性**：正弦扰动 ±2.5px + 椭圆形状 (1.1x/0.9y)
- **线条粗细变化**：2-4px 随机变化，模拟手写压力

#### 提示词优化 (`internal/llm/prompts/essay_composition_v1.9.md`)
- **整体批语字数**：50-100字 → **100-200字**
- **主要优点**：1-2点 → **2-3点（具体说明）**
- **改进建议**：1点 → **1-2点（可操作）**
- **新约束**：批语要具体、有针对性，避免空泛

#### 评语区域字号增大 (`internal/rendering/summary_renderer.py`)
- **标题字号**：28 → **32px**
- **正文字号**：20 → **24px**
- **详情字号**：16 → **20px**

### 修复

#### 评语区域高度计算不足
- **问题**：只显示部分批注（如 7 条只显示 2 条）
- **原因**：
  1. 高度计算只支持 8 条，实际绘制 10 条
  2. 每条批注只估算 2 行，实际需要 3-4 行
  3. 使用固定字号计算，实际用动态字号
- **修复**：
  - 支持 10 条批注高度计算
  - 精确计算每条批注的 3 个部分（原文行+建议行+评语行）
  - 使用与绘制一致的动态字号
  - 增加 20% 安全边距

#### 正则表达式无效转义警告
- **警告**：`SyntaxWarning: invalid escape sequence '\s'`
- **文件**：`internal/llm/llm_client.py`
- **修复**：`\s` → `\\s`（在字符类中需要双重转义）

### 相关文件
- `internal/extraction/text_extractor.py` (姓名/班级提取增强)
- `internal/rendering/annotation_renderer.py` (半圆圈号向上开口)
- `internal/rendering/summary_renderer.py` (便签风格 + 动态字号 + 高度计算)
- `internal/llm/prompts/essay_composition_v1.9.md` (批语字数增加)
- `internal/llm/llm_client.py` (正则转义修复)

---

## [V2.03] - 2026-01-22

### 新增

#### 评语区域渲染功能 (V2.0)

**功能概述**：
在作业图片下方自动拼接评语区域，显示得分、整体批语和分句点评。

**评语格式**：
```
┌─────────────────────────────────────────┐
│ 整体点评              得分：92 (红色)    │
│ 这篇作文特别棒！开头生动...              │
│ ─────────────────────────────────────── │
│ 分句点评(共7处问题)                      │
│ 1.原文:班张--》建议:应为'张老师' (红色)   │
│    评语：[错别字]，应为'张老师'          │
│ 2.原文:张老师的第一招...--》建议:...     │
│    评语：[佳句]，比喻生动，描写形象       │
└─────────────────────────────────────────┘
```

**技术实现**：

1. **提示词模板更新** (`internal/llm/prompts/essay_composition_v1.9.md`)
   - 添加评分标准（90-100/85-89/80-84 三档）
   - 添加整体批语要求（50-100字）
   - JSON 输出格式新增 `score` 和 `summary` 字段
   - 添加 `{essay_text}` 变量占位符传递作文内容
   - 修复 JSON 示例花括号转义问题（`{{` 和 `}}`）

2. **数据模型扩展** (`internal/llm/models.py`)
   - `LLMResponse` 新增字段：
     - `score: int = 0` - 作文得分（80-100）
     - `summary: str = ""` - 整体批语（50-100字）

3. **LLM 客户端更新** (`internal/llm/llm_client.py`)
   - 改为模板化提示词加载（从配置文件读取）
   - JSON 解析从数组格式 `\[.*\]` 改为对象格式 `\{.*\}`
   - 添加 score/summary 字段解析和验证
   - 添加回退提示词方法（模板加载失败时使用）

4. **评语区域渲染器** (`internal/rendering/summary_renderer.py`)
   - 新建 ~600 行渲染器模块
   - 支持单张/多张图片模式
   - 动态高度计算（根据内容长度）
   - PIL 绘制评语（支持中文）
   - 得分红色显示、右对齐
   - 分句点评支持 10 条批注
   - 批注类型映射（错别字/佳句/语病/增补建议）

5. **批改流程集成** (`internal/orchestration/corrector.py`)
   - Step 3 返回完整 LLMResponse（而非仅 annotations）
   - 新增 Step 5.5：评语区域渲染
   - 读取 Step 5 生成的描红图片，在下方拼接评语区域
   - 覆盖保存到原描红图片文件

**配置系统**：

新增 `RenderingConfig` 数据类 (`config.py`)：
```yaml
correction:
  rendering:
    enable_annotations: true   # 描红（红圈/波浪线/箭头）
    enable_comments: true      # 批语文字（图片空白处）
    enable_summary: true       # 评语区域（图片下方）
    merge_output: true         # 合并输出模式
```

**配置互斥逻辑**：
- 当 `enable_summary=true` 时，自动禁用 `enable_comments`
- 原因：评语区域已包含详细批改，避免功能重叠
- 实现：`corrector.py` 第 218-223 行

**最终输出**：
- 2 张图片（而非之前的 4 张）
- 每张包含：描红 + 评语区域
- 文件名：`*_p1_corrected.jpg`、`*_p2_corrected.jpg`

### 修复

#### 提示词模板缺少变量占位符
- **问题**：LLM 返回 "由于作文内容未提供"，annotations 为空
- **原因**：`essay_composition_v1.9.md` 缺少 `{essay_text}` 占位符
- **修复**：在模板末尾添加"待批改作文"部分，包含 `{student_class}`、`{student_name}`、`{essay_text}` 变量
- **影响**：修复后 LLM 能正确接收作文内容并返回批注

#### JSON 示例花括号转义问题
- **问题**：`[PromptLoader] 变量替换失败，缺少变量: '\n  "type"'`
- **原因**：JSON 示例中的单花括号 `{}` 与 Python `.format()` 冲突
- **修复**：将所有 JSON 示例的花括号改为双花括号 `{{}}`
- **修复位置**：
  - 错别字示例（第 40-56 行）
  - 长度限制示例（第 64-82 行）
  - 佳句示例（第 90-108 行）
  - 主格式示例（第 207-232 行）

#### 中文路径图片读取问题
- **问题**：`cv2.imread()` 无法读取中文路径，评语渲染失败
- **错误日志**：`[ WARN:0@66.620] global loadsave.cpp:241 cv::findDecoder imread_('outputs\浜?`
- **修复**：添加 `_read_image_chinese_path()` 方法
  - 使用 `np.fromfile()` + `cv2.imdecode()` 读取中文路径
  - 替换 `summary_renderer.py` 中的 `cv2.imread()` 调用
- **影响**：修复后评语区域可以正常拼接在描红图片下方

### 相关文件
- `internal/llm/prompts/essay_composition_v1.9.md` (提示词模板更新)
- `internal/llm/models.py` (LLMResponse 扩展)
- `internal/llm/llm_client.py` (模板化加载 + JSON 解析)
- `internal/rendering/summary_renderer.py` (新建，~600 行)
- `internal/orchestration/corrector.py` (Step 5.5 集成 + 配置互斥)
- `config.py` (RenderingConfig 新增)
- `config.yaml` (enable_summary 配置)

---

## [V2.02] - 2026-01-20

### 新增

#### HunyuanOCR 引擎集成 (2026-01-19)

**背景与决策过程**：

通过与 DeepSeek 的深入讨论和大量测试（详见 `docs/deepseek.md`），确认了 PaddleOCR 存在根本性的技术限制：

**PaddleOCR 的根本缺陷**：
- ❌ **设计限制**：PaddleOCR 天然不支持字符级坐标输出（官方 GitHub Issue #7053 明确说明）
- ❌ **识别准确率低**：基础 PaddleOCR 文字识别准确率仅 ~70%
- ❌ **段落级坐标**：PP-StructureV3 返回的是整个文字块/段落的坐标，无法精确定位子字符串
- ❌ **无法优化**：这是引擎的基础设计，不是 Bug，任何提示词优化或模型切换都无法突破

**技术决策**：全面转向 HunyuanOCR
- ✅ 识别准确率 95-99%（vs PaddleOCR 70%）
- ✅ 行级坐标输出（vs PP-StructureV3 段落级）
- ✅ 支持手写字识别
- ✅ 官方提供完整的后处理工具（坐标反归一化）
- ✅ 开源免费，可本地 vLLM 部署

**详细对比分析**（详见 `docs/hunyuan_vs_paddleocr_analysis.md`）：

| 维度 | PaddleOCR | HunyuanOCR | 改善 |
|------|-----------|------------|------|
| 识别准确率 | ~70% | ~95% | +25% |
| 坐标粒度 | 段落级 | 行级 | 显著提升 |
| 不同行批注 | 重叠 | 可区分 | ✅ 解决 |
| 同行多批注 | 重叠 | 仍然重叠 | ⚠️ 部分解决 |

**实测结果**（真实作文图片测试）：
```
✅ "拿手绝活" → 第5行 [162, 177, 841, 211]
✅ "真功夫"   → 第6行 [90, 217, 577, 251]
✅ "后背"     → 第7行 [161, 253, 862, 289]
✅ "小声"     → 第13行 [152, 481, 875, 522]
✅ "精准"     → 第18行 [142, 688, 896, 731]
```
**结论**：80-90% 的批注在不同行，完全不重叠！

**提示词测试过程**（详见 `docs/hunyuan_prompts_to_test.md`）：

通过官方 Demo 手动测试了 3 种提示词模板：

**提示词 1：按句子分割（推荐但未达到字符级）**
```
请分析这张作文图片，按以下要求输出：
1. 识别图片中的所有手写文字
2. 按标点符号分割句子，每个句子单独输出坐标
3. 输出格式：文本(x1,y1),(x2,y2)
```
**结果**：输出整段文字，未达到字符级

**提示词 2：按语义分割**
```
1. 按照语义单元分割文字（如：主谓宾完整的短语、句子成分）
2. 每个语义单元独立输出坐标
```
**结果**：坐标格式更规范，但仍为行级

**提示词 3：简化版（官方推荐）**
```
识别图片中的文字，对每个文字块输出坐标。
要求：
- 遇到标点符号（如：。，、""）就分割
- 每个分割后的部分独立输出坐标
- 输出格式：文本(x1,y1),(x2,y2)
```
**结果**：✅ 最佳输出格式，被采纳为默认提示词

**坐标解析与反归一化**：

根据官方 GitHub Issue #76，HunyuanOCR 输出的坐标是归一化值（[0,1000]），需要反归一化：

```python
def denormalize_coordinates(coord: Tuple[float, float],
                             image_width: int, image_height: int) -> Tuple[int, int]:
    """从 [0,1000] 归一化坐标转换为像素坐标"""
    x, y = coord
    denorm_x = int(x * image_width / 1000)
    denorm_y = int(y * image_height / 1000)
    return (denorm_x, denorm_y)
```

**实施测试**：

1. **官方 Demo 手动测试**
   - 使用腾讯混元官方演示界面测试提示词
   - 上传真实作业图片（`D:\tools\homework-ocr\bak\jpg\01.jpg`）
   - 验证输出格式和坐标精度

2. **端到端测试脚本** (`tests/test_hunyuan_e2e.py`)
   - 快速验证 HunyuanOCR 集成到批改流程
   - 完整测试从 OCR → LLM → 坐标映射 → 渲染输出
   - 输出详细的批注信息和处理时间

**配置示例**：
```yaml
ocr:
  engine: "hunyuan"
  hunyuan:
    vllm_api_url: "http://101.126.93.180:3006/v1"
    api_key: "your-api-key"
    default_prompt: "识别图片中的文字，对每个文字块输出坐标。要求：遇到标点符号（如：。，、""）就分割；每个分割后的部分独立输出坐标；输出格式：文本(x1,y1),(x2,y2)"
```

**相关文档**：
- `docs/deepseek.md` - 与 DeepSeek 讨论完整记录
- `docs/hunyuan_prompts_to_test.md` - 提示词测试记录
- `docs/hunyuan_vs_paddleocr_analysis.md` - 对比分析
- `docs/hunyuan_ocr_migration_plan.md` - 迁移计划

#### 渲染配置系统

### 新增

#### 渲染配置系统
- **渲染开关配置** (`config.yaml`)
  - `enable_annotations`: 控制是否启用描红（圆圈、波浪线、箭头等）
  - `enable_comments`: 控制是否启用批语（红色文字评语）
  - `merge_output`: 控制是否合并输出
    - `true`: 每张输入图片生成1张输出（包含描红+批语）
    - `false`: 每张输入图片生成2张输出（1张描红 + 1张批语）

#### 合并渲染功能
- **_step_5_render_combined** (`internal/orchestration/corrector.py`)
  - 根据配置自动选择合并渲染或分开渲染
  - 合并模式：在每张图片上同时绘制描红和批语
  - 分开模式：分别生成描红图片和批语图片
- **_render_merged** 方法
  - 读取原图 → 绘制描红 → 绘制批语 → 保存为单张图片
  - 输出文件名格式：`{班级}_{姓名}_{时间戳}_p{页码}_corrected.jpg`

#### 全局坐标匹配策略
- **优先匹配 + 全局回退** (`internal/mapping/coordinate_mapper.py`)
  - 步骤1：优先在 LLM 指定的页面中匹配
  - 步骤2：如果匹配分数 < 0.7，触发全局搜索（所有页面）
  - 步骤3：比较两者，返回分数更高的结果
- **_find_best_match_global** 方法
  - 在所有页面中搜索最佳匹配
  - 解决跨页批注分配问题（如第2页的句子匹配到第2页而非第0页）

### 修复

#### 多页内容过滤问题
- **_detect_region_type** (`internal/ocr/structure_engine.py` 和 `hunyuan_engine.py`)
  - 问题：第2页顶部的正文内容被误标记为 `header`，在文本提取时被过滤
  - 修复：移除自动标记为 `header` 的逻辑，只标记明确的学生信息字段
  - 影响：修复后第2页开头的 "说我，却早发现我没认真听课！" 能正确发送给 LLM

#### 多页批注分配问题
- **Step 4.2** (`internal/orchestration/corrector.py`)
  - 问题：所有批注的 `image_index` 都是 0（LLM 默认值），导致批注都分配到第1页
  - 修复：添加自动更新逻辑，根据 `matched_block.page_index` 更新 `annotation.image_index`
  - 结果：第2页的批注能正确分配到第2页

#### AnnotationRenderer 批量绘制问题
- **_step_5_render_annotations** (`internal/orchestration/corrector.py`)
  - 问题：`all_mapping_results=[mapping_results]` 只是包装，没有按页面分组
  - 修复：正确按页面组织映射结果 `results_by_page[page_idx]`
  - 结果：2张输入图片能正确生成2张输出图片（而不是1张）

#### Windows 中文路径保存问题
- **cv2.imencode + tofile** (`internal/rendering/annotation_renderer.py` 和 `comment_renderer.py`)
  - 问题：Windows 下 `cv2.imwrite()` 不支持中文路径
  - 修复：使用 `cv2.imencode('.jpg', image)` + `encoded_img.tofile(output_path)`
  - 影响：修复后可以在 Windows 下正常保存中文文件名

#### API 下载路由中文文件名支持
- **URL 编码** (`api.py`)
  - 使用 `urllib.parse.quote()` 编码中文文件名
  - 设置 `Content-Disposition: filename*=UTF-8''` 头

#### 合并渲染方法名错误 (2026-01-21)
- **_render_merged** (`internal/orchestration/corrector.py`)
  - 问题：调用 `self.annotation_renderer._draw_annotation(image, result)` 方法不存在
  - 错误：`'AnnotationRenderer' object has no attribute '_draw_annotation'`
  - 修复：方法名改为 `_draw_single_annotation`
  - 影响：修复后合并渲染模式可以正常工作

### 改进

#### 输出文件命名优化
- **时间戳和学生信息**
  - 格式：`{班级}_{姓名}_{时间戳}_p{页码}_annotated.jpg`
  - 清理文件名中的特殊字符（括号、空格）
  - 添加页码序号避免冲突

#### 代码清理
- **删除未使用的方法**
  - 移除 `_try_cross_page_match` 方法（已被 `_find_best_match_global` 替代）

### 配置变更

**新增**：
```yaml
correction:
  rendering:
    enable_annotations: true   # 是否启用描红
    enable_comments: true      # 是否启用批语
    merge_output: true         # 是否合并输出
```

### 相关文件
- `internal/orchestration/corrector.py` (渲染逻辑重构)
- `internal/mapping/coordinate_mapper.py` (全局匹配策略)
- `internal/ocr/structure_engine.py` (region_type 检测修复)
- `internal/ocr/hunyuan_engine.py` (region_type 检测修复)
- `internal/rendering/annotation_renderer.py` (中文路径支持)
- `internal/rendering/comment_renderer.py` (中文路径支持)
- `api.py` (下载路由优化)
- `config.yaml` (渲染配置新增)

---

## [V2.01] - 2026-01-15

### 重要发现

#### 子字符串坐标计算问题 - 已放弃（基础OCR引擎限制）

**问题描述**：
- 当同一文字块中存在多个批注时，所有批注都使用整个文字块的坐标，导致描红圆圈完全重叠
- 例如："拿手绝活" 和 "真功夫" 在同一段落中，但都获得相同的块级坐标 `[71, 226, 827, 320]`

**根本原因**：
- **PP-StructureV3 返回段落级坐标，不是字符级坐标**
  - PP-StructureV3 是版面分析引擎，设计用于识别文档结构（标题、段落、表格等）
  - 它返回的是整个文字块/段落的坐标，而非其中每个字符的坐标
  - 这是引擎的基础设计，不是 Bug

**尝试的解决方案**（全部失败）：

1. **简单线性插值** (`_simple_linear_interpolation`)
   - 实现：根据字符在文本中的位置比例，线性计算坐标
   - 结果：❌ 对多行文本精度很低，无法准确定位子字符串

2. **精确坐标计算** (步骤 4.5 in `corrector.py`)
   - 实现：在渲染前计算精确坐标
   - 结果：❌ 坐标计算正确，但渲染时仍使用块级坐标，问题未解决

3. **碰撞检测和位置调整** (步骤 4.6 in `corrector.py`)
   - 实现：检测重叠圆圈，自动调整位置
   - 结果：❌ 生成了无效坐标，使问题更糟

4. **行级别 OCR** (`_recognize_with_basic_ocr`)
   - 尝试：切换到基础 PaddleOCR 进行行级检测
   - 结果：❌ API 兼容性问题（`cls` 参数在新版本不支持）
   - 额外问题：基础 PaddleOCR 文字识别准确率仅 ~70%，不可接受

**为什么放弃**：
- 这不是代码问题，而是 **OCR 引擎的基础能力限制**
- PP-StructureV3 的设计目标是版面分析，不是字符级定位
- 基础 PaddleOCR 虽然可以返回行级坐标，但：
  - 文字识别准确率仅 ~70%（生产环境不可接受）
  - API 兼容性问题（新版本不支持 `cls` 参数）
  - 无法处理复杂排版和手写字

**建议的替代方案**：
1. **HunyuanOCR**（腾讯混元）
   - 优点：字符级坐标、更高的识别准确率（>95%）、支持手写字
   - 缺点：需要集成新的 OCR 引擎

2. **EasyOCR**
   - 优点：支持字符级坐标、多语言支持
   - 缺点：速度较慢

3. **Tesseract**
   - 优点：支持字符级坐标
   - 缺点：中文识别准确率低（~60-70%）

**当前状态**：
- ✅ 精确坐标计算已实现（例如 "胜张" 获得 `[274.5, 226, 332.7, 320.0]` 而非块级坐标）
- ❌ 但渲染仍显示重叠圆圈，因为算法无法区分同一块中的不同批注
- ❌ OCR 文字识别准确率 ~70%，不可用于生产

**相关文件**：
- `internal/mapping/coordinate_mapper.py` (行 1033-1150：线性插值实现)
- `internal/orchestration/corrector.py` (行 240-260：步骤 4.5 和 4.6)
- `internal/ocr/structure_engine.py` (行 320-380：行级别 OCR 尝试)
- `tests/test_simple_coords.py`、`tests/test_line_level_ocr.py`

---

## [V2.0] - 2025-01-12

### 重大变更
- **OCR 引擎升级**：从 PaddleOCR + Tesseract 升级到 **PP-StructureV3 + PaddleOCR-VL 双引擎架构**
- **移除 Tesseract**：完全移除 Tesseract 依赖，统一使用 PaddleOCR 生态
- **配置简化**：移除 `engine_version`、`tesseract_threshold` 等配置项

### 新增

#### PP-StructureV3 结构化 OCR 引擎
- **StructureOCREngine** (`internal/ocr/structure_engine.py`)
  - PP-StructureV3 主引擎：
    - 版面分析（标题、段落、表格、公式、图片）
    - 像素级精确坐标定位
    - 智能阅读顺序恢复
    - 数学公式 LaTeX 输出
    - 表格结构解析
  - PaddleOCR-VL 智能验证：
    - 0.9B 视觉语言模型
    - 置信度 <0.8 时触发验证
    - 复杂公式语义理解
    - 手写字太乱时的上下文修正
    - 生僻字根据语境推断

#### 数据模型扩展
- **ElementType** 枚举：TEXT、TITLE、TABLE、FORMULA、IMAGE、FIGURE、LIST、HEADER、FOOTER
- **SourceModel** 枚举更新：
  - 移除：TESSERACT、PADDLEOCR
  - 新增：PP_STRUCTURE_V3、PADDLEOCR_VL
- **TextBlock** 新字段：
  - `element_type`：文档元素类型
  - `latex`：LaTeX 表达式（公式类型）
  - `table_data`：表格数据
  - `reading_order`：阅读顺序
  - `region_type`：区域类型

### 改进
- **坐标精度**：PP-StructureV3 提供更精确的版面分析和坐标定位
- **公式支持**：支持数学公式的 LaTeX 输出，为数学作业批改打下基础
- **表格识别**：支持复杂表格结构解析，适用于复杂题目
- **验证机制**：PaddleOCR-VL 提供更智能的验证，处理低置信度和复杂内容

### 移除
- **SmartOCREngine**：旧的 PaddleOCR + Tesseract 引擎
- **Tesseract 依赖**：pytesseract、tesseract-ocr 系统包
- **配置项**：
  - `ocr_engine_version`
  - `tesseract_threshold`
  - `use_angle_cls`
  - `det_limit_side_len`
  - `rec_batch_num`

### 配置变更
**新增**：
```yaml
ocr:
  vl_enabled: true              # 启用 PaddleOCR-VL 验证
  vl_verify_threshold: 0.8      # VL 验证阈值
  vl_verify_formula: true       # 验证数学公式
  use_doc_orientation_classify: false  # 文档方向分类
  use_doc_unwarping: false      # 文档去畸变
```

**移除**：
```yaml
ocr:
  # 以下配置项已移除
  engine_version: "v2"          # 不再需要
  tesseract_threshold: 0.75     # 不再需要
```

### 依赖变更
**新增**：
- `paddleocr[all]>=3.0.0`（包含 PP-StructureV3、PaddleOCR-VL、PP-ChatOCRv4）

**移除**：
- `pytesseract`
- `tesseract-ocr`（系统依赖）

### API 示例
```python
from internal.ocr import StructureOCREngine

# 初始化引擎
engine = StructureOCREngine(
    use_gpu=True,
    gpu_id=0,
    lang="ch",
    vl_enabled=True,
    vl_verify_threshold=0.8,
)

# 识别图片
text_blocks = engine.recognize(image, page_index=0)

# TextBlock 结构
for block in text_blocks:
    print(f"文本: {block.text}")
    print(f"类型: {block.element_type.value}")  # text/title/table/formula/image
    print(f"来源: {block.source.value}")        # pp_structure_v3/paddleocr_vl
    print(f"坐标: {block.box}")
    if block.latex:
        print(f"公式: {block.latex}")
```

---

## [V1.52] - 2025-01-11

### 新增

#### 批语绘制模块
- **批语绘制器** (`internal/rendering/comment_renderer.py`)
  - 在作业图片上绘制红色批语文字
  - 批语位置智能定位：
    - 错别字：在圆圈下方
    - 佳句/语病：在波浪线上方
    - 增补建议：在箭头附近
  - 字体大小：小五号（9pt）
  - 自动文字换行（每行约10个字）
  - 半透明白色背景提高可读性
  - 自动加载中文字体（微软雅黑/黑体/宋体）
  - 批量绘制支持

#### 测试
- 批语绘制器: 7 个单元测试

### API 示例
```python
from internal.rendering import CommentRenderer, draw_comments_on_image

# 使用类
renderer = CommentRenderer()
renderer.render_comments(image_path, mapping_results, output_path)

# 使用便捷函数
output_path = draw_comments_on_image(image_path, mapping_results)
```

---

## [V1.51] - 2025-01-11

### 重大变更
- **架构重构**: 从多模态大模型架构完全重构为 **OCR 精确定位架构**
- **技术栈升级**: 引入 PaddleOCR + Tesseract 多模型融合
- **配置分离**: `.env` 仅存储敏感信息，`config.yaml` 管理业务配置
- **多学科支持**: 支持语文作文、语文作业、数学作业、英语等不同学科

### 新增

#### 核心模块
- **图像预处理模块** (`internal/preprocessing/`)
  - 图像质量检测（清晰度、对比度、亮度、文字覆盖率）
  - 自动裁剪和去边距
  - 13 个单元测试覆盖

- **OCR 引擎** (`internal/ocr/`)
  - PaddleOCR 主引擎（支持 GPU）
  - Tesseract 二次验证（置信度阈值）
  - 多页图片处理支持
  - OCR 结果 JSON 导出

- **文本提取器** (`internal/extraction/`)
  - 学生信息自动提取（班级、姓名）
  - OCR 错误自动校正（JSON 配置表）
  - 必填验证机制
  - 13 个单元测试覆盖

- **LLM 客户端** (`internal/llm/`)
  - 支持 10+ 个 LLM 提供商（OpenAI、DeepSeek、GLM、阿里等）
  - 提示词模板加载器
  - 自动重试机制（指数退避）
  - 多学科配置支持

- **坐标映射器** (`internal/mapping/`)
  - 四级匹配策略（精确→包含→模糊→上下文推断）
  - IoU 坐标计算
  - 跨页映射支持

- **描红绘制器** (`internal/rendering/`)
  - 错别字红色圆圈
  - 佳句/语病红色波浪线
  - 增补建议红色箭头
  - 批量绘制支持

#### 配置系统
- **多学科配置**: 支持不同学科使用不同的 LLM 和提示词
- **环境变量分离**: `.env` 仅存储 API Key
- **YAML 配置**: 统一的业务配置管理

### 改进
- **坐标精度**: 从多模态的 ±50-100px 提升到 ±5px（基于 OCR 坐标）
- **页面归属**: 准确率从 ~90% 提升到 >99%（基于 OCR 文字匹配）
- **可维护性**: JSON 格式的 OCR 校正表，无需修改代码
- **模块化**: 清晰的目录结构和职责划分

### 测试
- 预处理模块: 13 个单元测试
- 文本提取器: 13 个单元测试
- LLM 客户端: 5 个单元测试
- 坐标映射器: 3 个单元测试
- 描红绘制器: 5 个单元测试

### 依赖新增
- paddleocr>=2.10.0
- tesseract-ocr
- python-dotenv
- difflib (标准库)

---

## [V1.07] - 2026-01-09

### 新增
- **多页上下文解耦**: 新增 `current_index` 参数，支持多图片场景下的分页批注
- **addition 标记类型**: 支持增补建议的 V 型符号绘制
- **API 响应增强**: 返回 `draw_count`（实际绘制数量）和 `page_index`（当前页码）

### 改进
- **鲁棒性 JSON 修复**: 升级正则表达式支持 `image_index` 字段的提取
- **自适应坐标映射**: 针对句子类型（佳句、语病）的轴向反转检测
- **速率限制优化**: 引入清理阈值，减少 50%+ 列表操作
- **正则表达式优化**: 使用字符类 `[^"]` 替代非贪婪匹配，减少回溯

### 修复
- **明确异常处理**: 将裸 `except` 替换为具体的异常类型
- **格式化器复用**: 日志格式化器对象复用，避免重复创建

### 移除
- 移除 `time` 模块依赖，改用 `datetime.timestamp()`

### 性能
- 高频请求场景性能提升约 50%
- JSON 解析性能提升约 30%

## [V1.06] - 2026-01-08

### 新增
- **多页上下文解耦**: 引入 `image_index` 字段支持
- **鲁棒性 JSON 修复**: 正则提取截断的 JSON 对象
- **智能坐标纠偏**: 解决"竖线"Bug 的轴向反转检测
- **增补标记**: V 型符号绘制

### 改进
- 坐标系自适应（0-1 vs 0-1000）

## [V1.05] - 2026-01-07

### 新增
- 提示词增加学生信息提取规范（班级、姓名）

## [V1.04] - 2026-01-06

### 新增
- **多图片支持**: LinkAI 平台集成支持多张图片批量处理
- **image_index 字段**: 批注支持图片索引标识

### 改进
- 批注分组逻辑优化

## [V1.03] - 2026-01-05

### 新增
- 学生信息提取脚本 (`extract_student_info.py`)
- 支持嵌套 JSON 和 markdown 代码块解析

### 改进
- 提示词优化（V1.6 → V1.7）
- 稳定输出格式，禁止 markdown 代码块

## [V1.02] - 2026-01-04

### 新增
- **自动清理模块**: 按时间和容量的双重清理策略
- **下载目录配置**: 支持配置文件设置

### 改进
- API 响应格式简化（`url` 替代 `download_url`）

## [V1.01] - 2026-01-03

### 新增
- **配置文件驱动**: YAML 配置文件支持
- **API 密钥验证**: 多密钥支持
- **速率限制**: 自实现的分钟/小时两级限制
- **日志轮转**: RotatingFileHandler 支持
- **请求拦截器**: 统一的安全检查

### 改进
- 代码模块化重构

## [V1.0] - 2026-01-02

### 新增
- 基础图片批注功能
- 错误标记（红色圆圈）
- 佳句标记（波浪线）
- 坐标系自适应
- systemd 服务部署支持

---

## 版本说明

- **新增**: 新功能
- **改进**: 现有功能的优化
- **修复**: Bug 修复
- **移除**: 功能删除
- **安全**: 安全相关的修复
- **性能**: 性能优化
