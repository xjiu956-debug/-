const express = require('express');
const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.HTTP_PORT || 3000;

// 初始化 Redis 连接 (默认连接 localhost:6379)
const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB,
    keepAlive: 10000,
});


// 中间件：解析 JSON 格式的请求体 (短信转发器通常发送 JSON)
app.use(express.json());

/**
 * 接口 1: Webhook 接收端
 * 用于接收【短信转发器】发送的 POST 请求
 */
app.post('/webhook/sms', async (req, res) => {
    try {
        // 假设短信转发器发送的 JSON 结构包含 from (发送者/手机号) 和 content (短信内容) {"from": "13800138000", "content": "你的验证码是123456"}
        // 你需要在短信转发器 App 中配置对应的字段映射
        const { from,content } = req.body;

        if (!content) {
            console.log('收到格式错误的请求:', req.body);
            return res.status(400).send('格式错误');
        }
        // from 可能包含前缀，如 "sms_13800138000"，需要提取手机号部分
        const tempList = from.split("_");
        const cleanPhone = tempList[tempList.length - 1].replace(/\D/g, ''); // 简单清理手机号中的非数字字符
        const key = `sms:${cleanPhone}`;

        // 存入 Redis: 
        // KEY: sms:手机号
        // VAL: 短信内容
        // 'EX', 300: 过期时间 300秒 (5分钟)
        await redis.set(key, content, 'EX', 300);

        console.log(`[接收成功] 手机号: ${cleanPhone}, 内容已缓存 5 分钟`);
        res.status(200).send('OK');

    } catch (error) {
        console.error('Redis 写入错误:', error);
        res.status(500).send('Server Error');
    }
});

/**
 * 接口 2: 读取短信
 * 读取指定手机号的短信，如果存在则返回并删除(阅后即焚)
 */
app.get('/get-sms/:phone', async (req, res) => {
    try {
        const { phone } = req.params;

        if (!phone) {
            return res.status(400).json({ error: '请提供 phone 参数' });
        }

        const key = `sms:${phone}`;

        // 使用 get 获取内容
        const content = await redis.get(key);

        if (content) {
            // 如果有短信，先删除 (实现阅后即焚)
            await redis.del(key);
            
            // 返回 200 和短信内容
            return res.status(200).json({
                status: 'success', 
                phone: phone, 
                msg: content 
            });
        } else {
            // 没有短信或已过期，返回 400
            return res.status(400).json({ 
                status: 'error', 
                msg: '无短信或已过期' 
            });
        }
    } catch (error) {
        console.error('Redis 读取错误:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

app.use((req, res) => {
    res.status(404).end();
});


redis.once('ready', () => {
    console.log('[Redis] ✅ 连接成功且准备就绪');
    
    // 启动 Express 服务
    app.listen(port, () => {
        console.log(`[Server] 🚀 服务已启动: http://localhost:${port}`);
        console.log('[Server] 等待接收短信...');
    });
});

// 【错误】处理连接错误
redis.on('error', (err) => {
    // 密码错误 (致命错误)
    // Redis 返回的错误信息通常包含 NOAUTH 或 WRONGPASS
    if (err.message.includes('NOAUTH') || err.message.includes('WRONGPASS')) {
        console.error('[Redis] ❌ 严重错误: 密码配置错误！停止重试，退出程序。');
        redis.disconnect(); // 手动断开，防止 ioredis 继续重试
        process.exit(1);    // 退出进程，你需要去改代码或配置
    }

    // 服务未启动 / 连接被拒绝 (ECONNREFUSED)
    if(err.message === ''){
        console.error('[Redis] ❌ 严重错误: Redis 服务未启动或端口错误。');
        redis.disconnect(); // 手动断开，防止 ioredis 继续重试
        process.exit(1);    // 退出进程，你需要去改代码或配置
    }else if (err.message.includes('ECONNREFUSED')) {
        console.error('[Redis] ⚠️ 连接被拒绝: Redis 服务可能未启动或端口错误。正在重试...');
    }
});
