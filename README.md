# Intel Hub

黄金 / 云 GPU / Mac mini 翻新情报看板。公开接口适配器归一成同一份 `Quote`，带网页看板、JSON API 和 CLI。

公开仓库：[github.com/zmt18928708528-eng/intel-hub](https://github.com/zmt18928708528-eng/intel-hub)

## 看板能做什么

- **黄金**：Yahoo `GC=F` COMEX 期货 + currency-api 现货推导，可选 GoldAPI
- **显卡**：gputracker 云租最低价 + NVIDIA Partner Search + `NVDA` 情绪代理
- **Mac mini**：Apple 翻新页 JSON-LD / bootstrap；缺货时给出官方链接与 MSRP
- 星标关注（保存在浏览器本地）、搜索、90 秒自动刷新、`/api/intel` JSON

没有做账号体系、历史库、整站爬虫。零售库存继续优先 Keepa / 官方接口，而不是 HTML 解析器。

## 本地运行

需要 Node 22+。

```bash
git clone https://github.com/zmt18928708528-eng/intel-hub.git
cd intel-hub
npm install
npm run dev
```

CLI（不需要先起网页）：

```bash
npm run all
npm run gold
npm run gpu
npm run macmini
npm run intel -- all --json
```

JSON API：`GET /api/intel`，可选 `?only=gold|gpu|macmini`。

## 环境变量（可选）

不要提交 `.env`。部署时在 Vercel 项目设置里加：

| 变量 | 作用 |
| --- | --- |
| `GOLDAPI_KEY` | 打开 GoldAPI 现货路径 |
| `NVIDIA_LOCALE` | NVIDIA 目录地区，默认 `en-us` |

## 数据源

| 方向 | 接口 |
| --- | --- |
| 黄金期货 | Yahoo Finance `GC=F` |
| 黄金现货 | [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) `usd.xau` |
| 黄金可选 | GoldAPI `XAU/USD`（需 key） |
| 云 GPU | [gputracker.dev/gpu-data.json](https://gputracker.dev/gpu-data.json) |
| 消费级目录 | `api.nvidia.partners` |
| Mac mini | Apple 翻新页 JSON-LD / `REFURB_GRID_BOOTSTRAP` |

## 部署

Vercel 会从 `main` 自动构建（Nitro `vercel` preset）。构建命令走仓库里的 `npm run build`。
