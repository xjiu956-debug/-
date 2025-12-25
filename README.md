
# 📨 SMS Webhook Service (Node.js + Redis)

这是一个基于 Node.js 和 Redis 的高可用短信接收与临时存储服务。专为配合 **[短信转发器 (SmsForwarder)](https://github.com/AsheshPlays/SmsForwarder-en)** 使用而设计。

核心流程：**接收 Webhook -> 存入 Redis (5分钟有效期) -> 客户端读取 -> 立即删除 (阅后即焚)**。

## ✨ 核心特性

* **🛡️ 安全隐蔽**:
* 未定义路径一律返回空 `404`，不暴露服务器指纹。
* 业务逻辑错误不返回堆栈信息，仅返回状态码。


* **🔌 健壮连接**:
* **智能重连**: 内置 Redis 断线自动重连策略。
* **TCP KeepAlive**: 防止长时间空闲导致连接被防火墙切断。
* **依赖检查**: 只有 Redis 连接成功并就绪后，HTTP 服务才会启动，防止无效服务。


* **⚡ 高性能**: 基于 `ioredis` 和 `express`，极低延迟。
* **⚙️ 灵活配置**: 支持 `.env` 文件管理端口和数据库连接信息。

## 🛠️ 目录结构

```text
.
├── .env                # 配置文件 (端口、数据库信息)
├── server.js           # 主程序入口
├── package.json        # 项目依赖
└── README.md           # 说明文档

```

## 🚀 快速开始

### 1. 环境准备

* **Node.js**: v14+
* **Redis**: v5.0+ (需已启动服务)

### 2. 安装依赖

```bash
npm install express ioredis dotenv

```

### 3. 配置文件

在根目录创建 `.env` 文件（如果不存在），并填入以下内容：

```ini
# HTTP 服务端口
HTTP_PORT=3000

# Redis 连接信息
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # 如果没有密码，留空即可
REDIS_DB=0               # 选择 Redis 数据库索引 (0-15)

```

### 4. 启动服务

```bash
node server.js

```

> **启动状态说明**：
> * 如果不显示 URL，说明正在连接 Redis。
> * 只有当控制台看到 `[Redis] ✅ 连接成功且准备就绪` 后，HTTP 服务才会启动。
> 
> 

---

## 📡 API 接口文档

### 1. 接收短信 (Webhook)

用于接收短信转发器 App 推送的短信。

* **URL**: `/webhook/sms`
* **Method**: `POST`
* **Content-Type**: `application/json`
* **Body 参数**:
```json
{
  "from": "13800138000",
  "content": "【xx】您的验证码是 8888"
}

```


* **响应**:
* `200 OK`: 接收成功，已存入 Redis（有效期 5 分钟）。
* `404`: 请求格式错误或缺失字段。
* `503`: 服务暂不可用（Redis 断开重连中）。



### 2. 读取短信 (客户端)

读取指定手机号的最新短信。**注意：读取一次后，短信会立即从服务器删除。**

* **URL**: `/get-sms/{phone}` 其中 phone 替换成手机号
* **Method**: `GET`


* **响应**:
* **✅ 成功 (200)**:
```json
{
  "status": "success",
  "phone": "13800138000",
  "msg": "【xx】您的验证码是 8888"
}

```


* **❌ 无短信/已过期 (400)**: 返回空内容 (Content-Length: 0)。
* **❌ 参数错误 (404)**: 未提供手机号。



---

## 📱 短信转发器 App 配置指南

为了确保服务端能正确解析数据，请在手机端 **SmsForwarder** App 中按以下步骤配置：

1. **新增发送通道**: 选择 **WebHook** 类型。
2. **WebServer 地址**: `http://你的服务器IP:3000/webhook/sms`
* *注意：如果修改了 `.env` 中的端口，请同步修改此处。*


3. **请求方式**: `POST`
4. **自定义模板 (⚠️ 重要)**:
在 App 的“自定义模板”选项中，必须填入以下 JSON 结构：
```json
{
  "from": "[card_slot]",
  "content": "[content]"
}

```
必须要获取到设备信息或手动填写SIM信息



---

## ⚠️ 故障排查

| 现象 | 可能原因 | 解决方案 |
| --- | --- | --- |
| **控制台报错 `NOAUTH` / `WRONGPASS**` | Redis 密码错误 | 检查 `.env` 文件中的 `REDIS_PASSWORD`，修改后重启。 |
| **控制台报错 `ECONNREFUSED**` | Redis 未启动 | 检查 Redis 服务是否运行，端口是否为 6379。 |
| **手机发送成功，但无法读取** | 模板配置错误 | 检查 App 中的 JSON 模板字段名是否为 `from` 和 `content`。 |
| **读取接口一直返回 400** | 短信已过期 | 默认有效期为 300秒 (5分钟)，超时自动删除。 |
