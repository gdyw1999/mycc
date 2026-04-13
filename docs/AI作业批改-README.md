# 作业批改描红中台 - HunyuanOCR 版
> 基于 **HunyuanOCR vLLM API 精确坐标识别 + 文本大模型批改** 的作业批改系统，从根本上解决多模态大模型坐标定位不准（±50-100px）和页面归属错误的问题。
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-Internal-red.svg)](LICENSE)

**当前版本**: V2.10 | **状态**: v0.7 多模态集成

---

## 功能特性
### 核心功能

| 功能 | 说明 |
|------|------|
| **多模态批改 v0.7** | Qwen3.5-VL 直接图像识别，跳过 OCR 阶段（语文作业） |
| **OCR 精确识别** | 基于 HunyuanOCR vLLM API 的高精度文字识别（95-99% 准确率） |
| **行级坐标输出** | 返回行级坐标，解决 80-90% 的批注重叠问题 |
| **智能坐标映射** | 四级匹配策略 + 全局回退策略，性能优化（15.86× 提升）|
| **学生信息提取** | 自动识别班级和姓名，支持 OCR 错误自动校正 |
| **多页处理** | 智能页面归属，支持多页作文批改（准确率 >99%） |
| **质量检测** | 图像质量快速失败（清晰度、对比度、亮度、文字覆盖率） |
| **描红绘制** | 在原图上绘制红色标记（圆圈、波浪线、箭头） |
| **批语显示** | 智能定位的红色批语文本 |
| **合并渲染** | 支持描红+批语合并到一张图片，或分开输出 |
| **HTML 输出** | 支持生成交互式 HTML 文件（浮动标记点） |
| **多学科支持** | 支持语文作文、语文作业、数学作业、英语等学科批改 |
| **全局匹配** | 跨页坐标匹配，自动分配批注到正确页面 |
| **失败批注跟踪** | 用户可见的映射失败记录，完整错误详情 |
| **可配置阈值** | 所有映射阈值可通过 config.yaml 设置 |
| **性能优化** | 精确匹配早期退出、高分提前终止 |


### 技术亮点
- **v0.7 多模态模式**：Qwen3.5-VL 原生视觉理解，更快更准确
- **HunyuanOCR 引擎**：腾讯混元 OCR（95-99% 识别准确率，行级坐标输出）
- **vLLM API 部署**：支持本地 vLLM 部署，低延迟、高吞吐
- **配置驱动**: 所有配置通过 `config.yaml` 管理
- **模块化架构**: 清晰的目录结构，单一职责原则
- **单元测试覆盖**: 67+ 个单元测试全部通过
- **安全机制**: API 密钥验证 + 速率限制
- **优雅降级**: LLM 失败时自动降级，返回部分结果

---

## 项目结构
```
 新增文件结构

  internal/
  ├── llm/
  │   ├── prompts/
  │   │   ├── essay_composition_v2.0.md          # 语文作文（现有）
  │   │   ├── language_homework.md               # 语文作业（新增）
  │   │   ├── math_homework.md                   # 数学作业（未来）
  │   │   └── english_homework.md                # 英语作业（未来）
  │   │
  │   └── models_homework.py                     # 作业批改数据模型
  │
  ├── rendering/
  │   ├── annotation_renderer.py                 # 现有（作文描红）
  │   ├── summary_renderer.py                    # 现有（作文评语）
  │   └── language_renderer.py                   # 作业批改渲染器（新增）
  │       # 画勾/叉 + 评语区域
  │
  └── orchestration/
      ├── corrector.py                           # 现有（作文批改）
      └── homework_orchestrator.py               # 作业批改编排器（新增）
```  

```
homework-ocr/
├── api.py                          # Flask API 主入口（纯路由层）
├── config.py                       # 配置加载器
├── config.yaml                     # 主配置文件
├── .env                            # 环境变量（LLM API Key）
├── requirements.txt                # 依赖清单
├── internal/                       # 核心模块
│   ├── models.py                   # 数据模型定义
│   ├── logger.py                   # 日志系统
│   ├── preprocessing/              # 图像预处理
│   ├── ocr/                        # OCR 引擎（HunyuanOCR）
│   │   └── hunyuan_engine.py       # HunyuanOCR vLLM API 实现
│   │   └── __init__.py
│   ├── extraction/                 # 文本提取
│   ├── llm/                        # LLM 客户端
│   ├── mapping/                    # 坐标映射
│   ├── rendering/                  # 描红绘制 + 批语绘制
│   ├── orchestration/              # 批改编排器
│   └── middleware/                 # 安全中间件
├── tests/                          # 单元测试
│   ├── test_*.py                   # 67+ 个测试用例
│   └── test_integration.py         # 集成测试
├── docs/                           # 文档
│   ├── deployment.md               # 部署文档
│   ├── maintenance.md              # 维护文档
│   ├── systemd-service.md          # Systemd 服务配置
│   └── 01-后续计划.md              # 后续优化计划
├── CHANGELOG.md                    # 更新日志
└── outputs/                        # 输出目录
```

---

## 快速开始
### 1. 环境准备

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置文件

编辑 `config.yaml`：
```yaml
server:
  host: 0.0.0.0
  port: 3005
  external_url: http://localhost:3005

ocr:
  engine: hunyuan              # 使用 HunyuanOCR vLLM API
  hunyuan:
    vllm_api_url: http://your-vllm-server:3006/v1
    api_key: your-api-key

llm:
  provider: glm
  model: glm-4-flash
```

编辑 `.env` 文件：
```bash
GLM_API_KEY=your-api-key-here
# 或其他 LLM 提供商的 API Key
```

### 3. 运行测试

```bash
# 单元测试
pytest tests/ -v

# 集成测试
python tests/test_integration.py
```

### 4. 启动服务

```bash
# 开发环境
python api.py

# 生产环境（Gunicorn）
gunicorn -w 4 -b 0.0.0.0:3005 api:app
```

访问 http://localhost:3005/health 查看服务状态。
---

## API 接口说明

### 1. 作业批改接口

**端点**: `POST /correct`

**请求头**:
```
Content-Type: application/json
X-API-Key: key-Dp37Qho86A5Fa03Fc9b495
```

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| images | array | 是 | 图片列表（支持 Base64 或 URL） |
| subject | string | 否 | 学科类型，默认 "essay_composition" |
| output_format | string | 否 | 输出格式：`image`（默认）、`html`、`both` |

**输出格式说明**:
- `image`: 输出批改后的图片（默认）
- `html`: 输出交互式 HTML 文件（浮动标记点）
- `both`: 同时输出图片和 HTML 文件

**支持的学科类型**:
- `essay_composition`: 语文作文批改（默认，使用 HunyuanOCR + LLM）
- `language_homework`: 语文作业批改（v0.7 多模态模式，使用 Qwen3.5-VL）
- `math_homework`: 数学作业批改（待开发）
- `english`: 英语批改（待开发）

**学科模式说明**:

| 学科 | 模式 | OCR 引擎 | LLM 模型 | 说明 |
|------|------|----------|----------|------|
| essay_composition | v2.0 | HunyuanOCR | GLM-4-Flash | 6步批改流程，坐标描红 |
| language_homework | v0.7 | 无（VL直接识别） | Qwen3.5-VL | 多模态直接批改，HTML+JSON |
| math_homework | - | 待定 | 待定 | 未来支持 |
| english | - | 待定 | 待定 | 未来支持 |

**图片格式说明**:
- **Base64 格式**: `data:image/jpeg;base64,/9j/4AAQSkZJRg...`
- **URL 格式**: `https://example.com/image.jpg`
- 支持混合输入：同一请求中可同时包含 Base64 和 URL 图片

**请求示例**:
```json
{
  "images": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "https://example.com/homework_page2.jpg"
  ],
  "subject": "essay_composition"
}
```

**响应示例（成功）**:
```json
{
  "status": "success",
  "annotations": [
    {
      "type": "typo",
      "text": "拿手绝活",
      "reason": "应为\"拿手好戏\"",
      "box": [120, 250, 340, 290],
      "image_index": 0,
      "match_score": 0.92
    },
    {
      "type": "excellent",
      "text": "比喻生动形象",
      "reason": "比喻句运用恰当",
      "box": [450, 520, 680, 550],
      "image_index": 0,
      "match_score": 0.88
    }
  ],
  "output_urls": [
    "http://101.126.93.180:3005/download/%E4%BA%94%E7%8F%AD_%E5%BC%A0%E4%B8%89_20260126_143520_p0_corrected.jpg",
    "http://101.126.93.180:3005/download/%E4%BA%94%E7%8F%AD_%E5%BC%A0%E4%B8%89_20260126_143520_p1_corrected.jpg"
  ],
  "output_format": "image",
  "processing_time": 4.32,
  "correction_details": {
    "ocr_blocks": 69,
    "student_info": {
      "class": "五班",
      "name": "张三"
    },
    "pages_processed": 2,
    "total_annotations": 8
  }
}
```

**响应示例（HTML 输出）**:
```json
{
  "status": "success",
  "annotations": [...],
  "output_urls": [
    "http://101.126.93.180:3005/download/%E4%BA%94%E7%8F%AD_%E5%BC%A0%E4%B8%89_20260208_123456_p0.html"
  ],
  "output_format": "html",
  "processing_time": 5.1,
  "correction_details": {...}
}
```

**响应示例（部分成功）**:
```json
{
  "status": "partial_success",
  "errors": ["2 个批注映射失败"],
  "annotations": [...],
  "correction_details": {
    "failed_annotations": 2,
    "failure_details": [...]
  }
}
```

**响应示例（失败）**:
```json
{
  "status": "failure",
  "errors": [
    "OCR 识别失败: 图片质量不符合要求（清晰度不足）",
    "LLM 批改超时"
  ],
  "processing_time": 35.2
}
```

**批注类型说明**:

| 类型 | 说明 | 渲染样式 |
|------|------|----------|
| `typo` | 错别字 | 红色圆圈 |
| `punctuation` | 标点错误 | 红色圆圈 |
| `grammar` | 语法错误 | 红色波浪线 |
| `excellent` | 优秀表达 | 红色波浪线 |
| `addition` | 需要补充内容 | 红色箭头 |

### 2. 健康检查接口

**端点**: `GET /health`

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-26T14:35:20",
  "config": {
    "llm_provider": "glm",
    "llm_model": "glm-4-flash",
    "ocr_engine": "hunyuan",
    "rate_limit_enabled": true,
    "api_key_required": true
  }
}
```

### 3. 下载批改图片

**端点**: `GET /download/<filename>`

**请求头**: 无需特殊请求头

**响应**: JPG 图片文件（自动设置 Content-Disposition 头）

**文件名说明**:
- 合并模式：`{班级}_{姓名}_{时间戳}_p{页码}_corrected.jpg`
- 分开模式（描红）：`{班级}_{姓名}_{时间戳}_p{页码}_annotated.jpg`
- 分开模式（批语）：`{班级}_{姓名}_{时间戳}_p{页码}_commented.jpg`

---

## LinkAI 平台集成

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         LinkAI 平台                              │
│                    (https://linkai.bar)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   FRP 转发     │
                    │   端口: 3005   │  ◄── 外部访问端口
                    │   ↓            │
                    │   端口: 3005   │  ◄── 内部服务端口
                    └────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    作业批改 API 服务                             │
│                      端口: 3005                                  │
│                          api.py                                 │
│                                                                  │
│  功能:                                                           │
│  - HunyuanOCR vLLM API 识别                                      │
│  - LLM 智能批改                                                  │
│  - 精确坐标映射                                                  │
│  - 描红 + 批语渲染                                               │
│  - 多页作业处理                                                  │
│                                                                  │
│  外部访问地址: http://101.126.93.180:3005                       │
│  内部服务地址: http://127.0.0.1:3005                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────┐   ┌─────────────────┐
│  HunyuanOCR     │   │  LLM 批改服务    │
│  vLLM API       │   │  (多提供商)      │
│  端口: 3006      │   │  GLM/OpenAI/...│
├─────────────────┤   ├─────────────────┤
│ OCR 识别         │   │ 文本批改         │
│ 行级坐标输出      │   │ JSON 批注返回    │
└─────────────────┘   └─────────────────┘
```

**FRP 端口映射说明：**
- **外部访问端口**: 3005（公网可访问）
- **内部服务端口**: 3005（作业批改服务监听）
- **访问地址配置**: `server.external_url = "http://101.126.93.180:3005"`
- **生成的下载链接**: `http://101.126.93.180:3005/download/{filename}`

### 方式一：HTTP POST 集成

#### 1. LinkAI 平台配置

在 LinkAI 平台的**自定义插件**页面，选择 **HTTP协议** 标签：

**基本信息**:
- **插件名称**: `HomeworkOCR-HTTP`
- **插件描述**: `通过HTTP接口调用的作业批改服务`

**请求地址**:
```
POST http://101.126.93.180:3005/correct
```

**请求头**:
```json
{
  "Content-Type": "application/json",
  "X-API-Key": "key-Dp37Qho86A5Fa03Fc9b4954Ab95956c34E56"
}
```

**请求参数**:
```json
{
  "images": [
    "https://linkai.bar/files/20250126/upload_abc123.jpg",
    "https://linkai.bar/files/20250126/upload_def456.jpg"
  ],
  "subject": "essay_composition"
}
```

**参数说明**:
- `images`: 图片URL列表（从LinkAI上一步获取）
- `subject`: 学科类型（可选，默认 `essay_composition`）

**响应示例**:
```json
{
  "status": "success",
  "annotations": [...],
  "output_urls": [
    "http://101.126.93.180:3005/download/五班_张三_20260126_143520_p0_corrected.jpg"
  ],
  "processing_time": 18.5,
  "correction_details": {
    "student_info": {
      "class": "五班",
      "name": "张三"
    }
  }
}
```

**注意**：
- 本 API 为**同步响应**，请求后直接返回结果
- 无需轮询任务状态
- linkai默认超时时间**60秒**


**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| images | array | 是 | 图片列表（支持 Base64 或 URL） |
| subject | string | 否 | 学科类型，默认 "essay_composition" |

**支持的学科类型**:
- `essay_composition`: 语文作文批改（默认）
- `language_homework`: 语文作业批改（待开发）
- `math_homework`: 数学作业批改（待开发）
- `english`: 英语批改（待开发）

**图片格式说明**:
- **Base64 格式**: `data:image/jpeg;base64,/9j/4AAQSkZJRg...`
- **URL 格式**: `https://example.com/image.jpg`
- 支持混合输入：同一请求中可同时包含 Base64 和 URL 图片

### 方式二：使用 Python 代码块

在 LinkAI 平台的**工具**页面，创建自定义工具（Python 代码块）：

```python
def main(images, subject):
    # 以下为代码逻辑，注意缩进
    import json
    from urllib import request

    # API 配置
    API_BASE_URL = "http://101.126.93.180:3005"
    API_KEY = "key-Dp37Qho86A5Fa03Fc9b4954Ab95956c34E56"

    # 验证图片参数
    if not images:
        return {"result": {"status": "error", "error_message": "请提供作业图片"}}

    # 准备请求头
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }

    # 准备请求体
    payload = {
        "images": images if isinstance(images, list) else [images],
        "subject": subject or "essay_composition"
    }

    # 发送批改请求（同步响应，超时120秒）
    try:
        data = json.dumps(payload).encode('utf-8')
        req = request.Request(
            f"{API_BASE_URL}/correct",
            data=data,
            headers=headers,
            method='POST'
        )

        with request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))

        if result.get("status") == "success":
            # 批改成功，提取关键信息
            output_urls = result.get("output_urls", [])
            annotations = result.get("annotations", [])
            processing_time = result.get("processing_time", 0)
            correction_details = result.get("correction_details", {})
            student_info = correction_details.get("student_info", {})

            # 统计批注类型
            annotation_types = {}
            for ann in annotations:
                ann_type = ann.get("type", "unknown")
                annotation_types[ann_type] = annotation_types.get(ann_type, 0) + 1

            return {
                "result": {
                    "status": "success",
                    "student_class": student_info.get("class", "未知"),
                    "student_name": student_info.get("name", "未知"),
                    "processing_time": processing_time,
                    "total_annotations": len(annotations),
                    "annotation_types": annotation_types,
                    "output_urls": output_urls,
                    "download_links": "\n".join(output_urls)
                }
            }
        else:
            # 批改失败
            errors = result.get("errors", [])
            return {
                "result": {
                    "status": "failed",
                    "error_message": "、".join(errors) if errors else "批改失败",
                    "processing_time": result.get("processing_time", 0)
                }
            }

    except Exception as e:
        return {
            "result": {
                "status": "exception",
                "error_message": str(e)
            }
        }
```

**参数说明**：
- `images`: 图片URL（从LinkAI上一步获取，支持单个URL或列表）
- `subject`: 学科类型（可选，默认 `essay_composition`）

**返回格式说明**：

成功响应：
```json
{
  "status": "success",
  "student_class": "五班",
  "student_name": "张三",
  "processing_time": 18.5,
  "total_annotations": 8,
  "annotation_types": {
    "typo": 3,
    "punctuation": 2,
    "excellent": 2,
    "grammar": 1
  },
  "output_urls": [
    "http://101.126.93.180:3005/download/五班_张三_20260126_143520_p0_corrected.jpg"
  ],
  "download_links": "http://101.126.93.180:3005/download/..."
}
```

失败响应：
```json
{
  "status": "failed",
  "error_message": "OCR 识别失败: 图片质量不符合要求",
  "processing_time": 5.2
}
```

**关键区别**（对比 PPT 生成 API）：
| 特性 | PPT 生成 API | 作业批改 API |
|------|-------------|-------------|
| 响应方式 | 异步（需轮询） | 同步（直接返回） |
| 超时时间 | 120秒（轮询9次×10秒） | 120秒（单次请求） |
| 轮询逻辑 | 需要 | 不需要 |
| 处理时间 | 10-60秒 | 15-20秒 |

### 调试模式（无需 API Key）

开发测试时，可在 `config.yaml` 中清空 API 密钥列表：

```yaml
security:
  api_keys: []  # 空列表表示跳过 API 密钥验证
  rate_limit_enabled: false  # 禁用速率限制
```

**注意**：生产环境必须配置 API 密钥以保证安全。

### LinkAI Agent 完整配置示例

在 LinkAI 中创建作业批改 Agent：

```yaml
# Agent 名称
name: "作业批改助手"

# 描述
description: "智能批改学生作业，支持语文作文、数学作业等多学科"

# 工具配置
tools:
  - type: "http_request"
    name: "homework_correction"
    endpoint: "http://101.126.93.180:3005/correct"
    method: "POST"
    headers:
      X-API-Key: "key-Dp37Qho86A5Fa03Fc9b4954Ab95956c34E56"
      Content-Type: "application/json"
    timeout: 120

# 提示词模板
prompt: |
  你是一个智能作业批改助手。当用户上传作业图片时，调用批改工具进行处理。

  用户可能上传：
  - 单张作业图片
  - 多张作业图片（作文等）

  请从图片中提取学生的班级和姓名信息，然后调用批改API。

  批改完成后，向用户展示：
  1. 学生信息（班级、姓名）
  2. 批注数量
  3. 主要错误类型统计
  4. 批改结果下载链接
```

---

## 配置说明

### OCR 配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `engine` | OCR 引擎类型（hunyuan） | `hunyuan` |
| `hunyuan.vllm_api_url` | vLLM 服务地址 | `http://localhost:8000/v1` |
| `hunyuan.api_key` | API Key | `` |
| `hunyuan.default_prompt` | OCR 提示词模板 | （默认提示词） |
| `match_score_threshold` | 坐标匹配阈值 | `0.6` |

### LLM 配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `provider` | LLM 提供商 | `glm` |
| `model` | 模型名称 | `glm-4-flash` |
| `timeout` | 超时时间（秒） | `30` |

**支持的提供商**: `linkai`, `openai`, `deepseek`, `glm`, `ali`, `doubao`, `silicon`, `ollama`, `vllm`, `local`

### 学科配置（v0.7 多模态模式）

**language_homework v0.7 配置示例**:
```yaml
correction:
  subjects:
    language_homework:
      name: "语文作业批改"
      mode: "v07"                      # v0.7 多模态模式
      vl:
        provider: "ali"                # VL 模型提供商
        model: "qwen3.5-plus-2026-02-15"
        timeout: 180
        max_retries: 2
        temperature: 0.3
        max_tokens: 16384
      prompt_template: "internal/llm/prompts/qwen35_v0.7.md"
      output_dir: "outputs"            # 输出目录
      enable_correction: true          # 启用 OCR 校正表
      school_name: ""
      enabled: true
```

**配置项说明**:

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `mode` | 批改模式（legacy/v07） | `legacy` |
| `vl_provider` | VL 模型提供商 | `ali` |
| `vl_model` | VL 模型名称 | `qwen3.5-plus-2026-02-15` |
| `output_dir` | 输出目录 | `outputs` |
| `enable_correction` | 是否启用 OCR 校正表 | `true` |
| `school_name` | 学校名称 | `""` |

### 坐标映射配置（新增）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `mapping.base_threshold` | 基础匹配阈值 | `0.5` |
| `mapping.global_search_threshold` | 全局搜索触发阈值 | `0.7` |
| `mapping.enable_global_search` | 是否启用全局搜索 | `true` |
| `mapping.early_stop_threshold` | 高分提前终止阈值 | `0.95` |
| `mapping.log_failed_annotations` | 是否记录失败批注 | `true` |

**支持的提供商**: `linkai`, `openai`, `deepseek`, `glm`, `ali`, `doubao`, `silicon`, `ollama`, `vllm`, `local`

### 渲染配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `enable_annotations` | 是否启用描红（圆圈、波浪线、箭头） | `true` |
| `enable_comments` | 是否启用批语（红色文字评语） | `true` |
| `merge_output` | 是否合并输出（true=1张输出，false=2张输出） | `true` |

### 安全配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `api_keys` | API 密钥列表 | `[]` |
| `rate_limit_enabled` | 是否启用速率限制 | `true` |
| `rate_limit_per_minute` | 每分钟请求限制 | `10` |

---

## 批改流程

```
┌─────────────────────────────────────────────────────────────┐
│                     批改流程编排器                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. OCR 识别（带质量检测和预处理）                           │
│    └─> HunyuanOCR vLLM API 调用                            │
│    └─> 返回行级坐标和识别结果                              │
│                                                             │
│ 2. 文本提取                                                 │
│    └─> 学生信息提取（班级、姓名）                          │
│    └─> OCR 错误自动校正                                    │
│    └─> 全文拼接（过滤学生信息区域）                        │
│                                                             │
│ 3. LLM 批改                                                │
│    └─> 纯文本批改（不传图片）                              │
│    └─> JSON 格式批注返回                                   │
│                                                             │
│ 4. 坐标映射                                                 │
│    └─> 优先匹配 + 全局回退策略                             │
│    └─> 自动页面归属（image_index 更新）                    │
│    └─> 精确坐标计算                                        │
│                                                             │
│ 5. 渲染绘制（可配置）                                      │
│    ├─> 合并模式：描红+批语 → 1张输出图片                   │
│    └─> 分开模式：描红→1张图片，批语→1张图片               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 渲染模式说明

**合并模式** (`merge_output: true`):
- 输入 N 张图片 → 输出 N 张图片
- 每张图片同时包含描红和批语
- 文件名：`{班级}_{姓名}_{时间戳}_p{页码}_corrected.jpg`

**分开模式** (`merge_output: false`):
- 输入 N 张图片 → 输出 2N 张图片
- 描红图片：`{班级}_{姓名}_{时间戳}_p{页码}_annotated.jpg`
- 批语图片：`{班级}_{姓名}_{时间戳}_p{页码}_commented.jpg`

---

## 部署

### 生产环境部署

详见 [docs/deployment.md](docs/deployment.md)

```bash
# 配置 systemd 服务
sudo cp docs/homework-ocr.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable homework-ocr
sudo systemctl start homework-ocr
```

### Docker 部署（待实现）
```bash
docker build -t homework-ocr .
docker run -p 3005:3005 -e GLM_API_KEY=xxx homework-ocr
```

---

## 性能指标

| 指标 | 目标值 | 实际值 |
|------|--------|--------|
| 单页处理时间 | <6 秒 | ~4.3 秒 |
| 吞吐量 | >0.1 页/秒 | ~0.23 页/秒 |
| 坐标映射性能 | 基准性能 | 15.86× 提升（禁用全局搜索）|
| 单页批注映射 | <10ms | 6.34ms |
| 多页批注映射 | <1000ms | 529.86ms (10页) |
| 坐标精度 | <5 像素 | 待测试 |
| 页面归属准确率 | >99% | 待测试 |

---

## 技术栈

| 组件 | 技术 |
|------|------|
| OCR | HunyuanOCR vLLM API |
| 坐标精度 | 行级坐标输出（95-99% 识别准确率） |
| LLM | 支持 10+ 提供商 |
| Web 框架 | Flask 2.3+ |
| 图像处理 | OpenCV, PIL, NumPy |
| 配置 | YAML |
| 测试 | pytest |

---

## 文档

| 文档 | 说明 |
|------|------|
| [CHANGELOG.md](CHANGELOG.md) | 完整更新日志 |
| [docs/01-后续计划.md](docs/01-后续计划.md) | 后续优化计划 |
| [docs/deployment.md](docs/deployment.md) | 部署文档 |
| [docs/maintenance.md](docs/maintenance.md) | 维护文档 |
| [docs/systemd-service.md](docs/systemd-service.md) | Systemd 配置 |
| [docs/deepseek.md](docs/deepseek.md) | HunyuanOCR 技术决策讨论记录 |
| [docs/hunyuan_prompts_to_test.md](docs/hunyuan_prompts_to_test.md) | HunyuanOCR 提示词测试记录 |
| [docs/hunyuan_vs_paddleocr_analysis.md](docs/hunyuan_vs_paddleocr_analysis.md) | OCR 引擎对比分析 |
| [docs/hunyuan_ocr_migration_plan.md](docs/hunyuan_ocr_migration_plan.md) | HunyuanOCR 迁移计划 |

---

## 开发指南
### 运行测试

```bash
# 单元测试（67+ 个测试）
pytest tests/ -v

# 集成测试
python tests/test_integration.py

# API 测试
python tests/test_api.py

# 编排器测试
python tests/test_corrector.py
```

### 添加新的 LLM 提供商
编辑 `config.py`：
```python
SUPPORTED_PROVIDERS = [
    "linkai", "openai", "deepseek", "glm", "ali",
    "doubao", "silicon", "ollama", "vllm", "local",
    "your-provider",  # 添加新提供商
]
```

添加环境变量映射：
```python
PROVIDER_API_KEY_MAP = {
    ...
    "your-provider": "YOUR_PROVIDER_API_KEY",
}
```

---

## 更新日志

### V2.10 (2026-02-28)

**v0.7 多模态集成**:
- ✅ **Qwen3.5-VL 直接识别**：跳过 OCR 阶段，更快的处理速度
- ✅ **统一 API 路由**：通过 `subject=language_homework` 参数区分模式
- ✅ **V07Processor**：响应处理器，支持日期注入、教师名称固定
- ✅ **文件命名优化**：精确时间戳格式 `{班级}_{姓名}_{YYYYMMDD_HHMMSS}_p1.html`
- ✅ **HTML + JSON 双输出**：美观 HTML 报告 + 结构化 JSON 数据
- ✅ **OCR 校正表保留**：作为最终校正层，确保识别准确性

**配置系统扩展**:
- ✅ SubjectConfig 新增 v0.7 字段（mode、vl_provider、vl_model 等）
- ✅ config.yaml 新增 language_homework v0.7 配置

**提示词模板更新**:
- ✅ `qwen35_v0.7.md`：明确 JSON 格式，双输出格式（HTML + JSON）

**Bug 修复**:
- ✅ 文件命名双下划线问题
- ✅ 输出目录错误（outputs/v07 → outputs）
- ✅ 日期占位符未替换（2023-09-XX → 当前日期）
- ✅ 教师名称不固定（使用正则替换为 "LinkAi 智慧助教"）

**遗留文件保留**:
- ✅ tsc_orchestrator.py、qwen_ocr_combiner.py 等文件保留
- ✅ 供未来 math_homework 和 english_homework 使用

### V2.08 (2026-02-14)

**坐标映射性能优化**:
- ✅ **失败批注记录**：用户可见，完整失败详情（text, type, error_message）
- ✅ **阈值可配置**：所有阈值可通过 `config.yaml` 设置
- ✅ **详细日志**：调试友好，完整上下文（页码、分数、匹配方法）
- ✅ **性能优化**：
  - 精确匹配早期退出（score >= 1.0 立即停止，**10× 提升**）
  - 高分提前终止（score >= 0.95 提前终止，**2× 提升**）
- ✅ **配置文件支持**：新增 `ocr.mapping` 配置区域
- ✅ **性能基准测试**：验证 **15.86× 性能提升**（禁用全局搜索）

**API 响应增强**:
- ✅ 新增 `partial_success` 状态（部分批注映射失败）
- ✅ 新增 `correction_details.failed_annotations` 字段
- ✅ 新增 `correction_details.failure_details` 数组

**配置示例**:
```yaml
ocr:
  mapping:
    base_threshold: 0.5
    global_search_threshold: 0.7
    enable_global_search: true    # 单页作业可设为 false 提升性能
    early_stop_threshold: 0.95
    log_failed_annotations: true
```

**性能基准测试结果**:
- 单页作文：6.34ms（1.27ms/批注）
- 多页作文（3页）：73.07ms（7.31ms/批注）
- 多页作文（10页）：529.86ms（26.49ms/批注）
- 禁用全局搜索：**15.86× 性能提升**

### v2.7 (2026-02-08)

**HTML 渲染输出功能**:
- ✅ 新增 HTML 输出格式（`output_format: "html"`）
- ✅ 浮动标记点（点击弹出批注详情）
- ✅ Base64 图片嵌入（独立文件，无需外部资源）
- ✅ 响应式设计（支持移动端）
- ✅ 动画效果（脉冲动画吸引注意）
- ✅ 模态框详情展示（ESC 键关闭）
- ✅ 完整的单元测试和集成测试（28 个测试用例）
- ✅ 向后兼容（默认 `output_format: "image"`）

**API 接口增强**:
- ✅ `/correct` 接口支持 `output_format` 参数
- ✅ 响应包含 `output_format` 字段
- ✅ 支持 `"image"`, `"html"`, `"both"` 三种输出格式

**配置文件更新**:
- ✅ 添加 `correction.rendering.enable_html` 开关
- ✅ 添加 `correction.rendering.html_marker_size` 配置
- ✅ 添加 `correction.rendering.html_marker_animation` 配置
- ✅ 添加 `correction.rendering.html_responsive` 配置

### v2.6 (2026-01-26)

**PaddleOCR 生态完全移除**:
- 🗑️ 删除 `internal/ocr/structure_engine.py` (~900 行代码)
- 🧹 清理配置文件中未使用的 PaddleOCR 配置
- 🧹 简化 `OrchestratorConfig`，移除 PaddleOCR 相关字段
- 🧹 更新 `SourceModel` 枚举，仅保留 `HUNYUAN_OCR`
- ✅ 完全基于 HunyuanOCR vLLM API

**代码减法与安全审查**:
- 🗑️ 删除未使用代码（废弃端点、孤儿方法）
- 🧹 导入优化（移除重复导入）
- 🔒 SSL 验证配置化（`security.ssl_verify`）
- 🔒 类型转换安全修复

### v2.2 (2026-01-20)

**HunyuanOCR 引擎集成测试** (2026-01-19):
- 📋 官方 Demo 手动测试（提示词效果对比）
- 📋 端到端测试脚本（`tests/test_hunyuan_e2e.py`）
- 📋 技术决策文档（`docs/deepseek.md`、对比分析、迁移计划）
- ✅ 识别准确率 95-99%（vs PaddleOCR 70%）
- ✅ 行级坐标输出（解决 80-90% 的批注重叠问题）
- ✅ 提示词模板优化（3 种方案测试）
- ✅ 坐标反归一化实现（[0,1000] → 像素坐标）

**多页批注 + 合并渲染功能**:
- ✅ 渲染配置系统（描红开关、批语开关、合并输出开关）
- ✅ 合并渲染模式（描红+批语 → 1张输出图片）
- ✅ 全局坐标匹配策略（优先匹配 + 全局回退）
- ✅ 多页批注自动分配（image_index 自动更新）
- ✅ 修复首页内容过滤问题
- ✅ 修复 Windows 中文路径保存问题
- ✅ 输出文件命名优化（时间戳、学生信息、页码）

### v2.1 (2026-01-15)

**子字符串坐标计算问题研究**:
- ⚠️ PP-StructureV3 返回段落级坐标，无法精确定位子字符串
- ⚠️ 基础 PaddleOCR 文字识别准确率仅 ~70%
- 📝 建议使用 HunyuanOCR 替代方案

### v2.0 (2025-01-11)

**PP-StructureV3 双引擎架构升级**:
- ✅ PP-StructureV3 主引擎（版面分析、公式识别、表格解析）
- ✅ PaddleOCR-VL 智能验证（7.9B 视觉语言模型）
- 🗑️ 移除 Tesseract 依赖
- ✅ 支持数学公式 LaTeX 输出
- ✅ 支持复杂表格结构解析
- ✅ 配置简化（移除 engine_version）
- ✅ 全面更新单元测试

### v1.60 (2025-01-11)

**阶段五和六完成**:
- ✅ 批改编排器（6 步完整流程）
- ✅ Flask API 重构（单一职责原则）
- ✅ 安全中间件（API 密钥 + 速率限制）
- ✅ 集成测试（67+ 测试全部通过）
- ✅ 部署文档和维护文档

---

## 许可证
内部使用

---

**文档版本**: v2.10
**最后更新**: 2026-02-28
**作者**: Claude Code

