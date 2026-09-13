# Intel Hub（黄金 / 显卡 / Mac mini）

Repo: https://github.com/zmt18928708528-eng/intel-hub

不是完整站点工程。只做三件事：

1. 用现成 API / CLI 风格接口拉情报
2. 用 TypeScript 适配器归一成同一份 `Quote`
3. 提供 `cli` + 一个本地看板

不要从零造爬虫平台、账号体系、历史库、告警中台。那些直接 fork 下面的 GitHub 项目。

## 先搜到、可直接复用的项目

| 方向 | 仓库 / 接口 | 怎么用 |
| --- | --- | --- |
| 黄金 CLI | [gadicc/yahoo-finance2](https://github.com/gadicc/yahoo-finance2) | `npx yahoo-finance2 quote GC=F` |
| 黄金 CLI | [sderosiaux/ticker-cli](https://github.com/sderosiaux/ticker-cli) | `ticker-cli GC=F` |
| 黄金免费表 | [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) | `usd.json` 里的 `xau` |
| 黄金 MCP | [goldapi-io/goldapi-mcp-server](https://github.com/goldapi-io) | `@goldapi/mcp-server`，需要 `GOLDAPI_KEY` |
| 云 GPU 价 | [gputracker.dev/gpu-data.json](https://gputracker.dev/api-docs) | 免密钥 JSON，约 6h 更新 |
| 云 GPU 看板 | [joemccann/gpu-availability](https://github.com/joemccann/gpu-availability) | RunPod / Vast 官方接口 |
| 消费级 FE 库存 | [l-zariqi/gpu-radar](https://github.com/l-zariqi/gpu-radar) | `api.nvidia.partners` + `api.store.nvidia.com` |
| 零售蹲货（重） | [jef/streetmerchant](https://github.com/jef/streetmerchant) | 多电商库存机器人，不要当网站内核 |
| Mac mini 翻新 | [saadiq/refurb-mini-spy](https://github.com/saadiq/refurb-mini-spy) | JSON-LD / bootstrap，本仓库适配器同源思路 |
| Mac mini Slack | [brosePR/macmini-watch](https://github.com/brosePR/macmini-watch) | GitHub Actions cron |
| Apple 翻新 CLI | [zmoog/refurbished](https://github.com/zmoog/refurbished) | Python CLI，可当对照源 |

## 本仓库接了哪些接口

- 黄金：Yahoo `GC=F`（免密钥）→ currency-api 现货推导 → 可选 GoldAPI
- 显卡：gputracker 云租最低价 → NVIDIA Partner Search（不稳定就降级）→ `NVDA` 情绪代理
- Mac mini：Apple 翻新页 JSON-LD / `REFURB_GRID_BOOTSTRAP` → 缺货时给官方链接 + MSRP 参考 → `AAPL` 代理

没有做：Amazon / Newegg / JD 整站爬取。零售页大多没有稳定公开 API，继续扩的话优先 Keepa / Best Buy developer key，而不是再写一套 HTML 解析器。

## 命令

Node 22+ 可直接跑（自带 type stripping，tsx 可选）：

```bash
git clone https://github.com/zmt18928708528-eng/intel-hub.git
cd intel-hub
npm run all
npm run gold
npm run gpu
npm run macmini
npm run serve        # http://127.0.0.1:8787
```

可选环境变量：

```bash
GOLDAPI_KEY=...      # 打开 GoldAPI / 也可接官方 MCP
NVIDIA_LOCALE=en-us  # 或 en-gb
PORT=8787
```

GoldAPI MCP（Cursor / Claude）示例：

```json
{
  "mcpServers": {
    "goldapi": {
      "command": "npx",
      "args": ["-y", "@goldapi/mcp-server"],
      "env": { "GOLDAPI_KEY": "your-key" }
    }
  }
}
```

## 下一步（按需加，不要一次铺开）

1. 用 GitHub Actions 每 15–30 分钟跑 `npm run intel -- all --json`，把结果提交到 `data/latest.json`
2. 只对「COMEX 突破阈值 / 5090 云租跌破 X / 翻新 Mini 重新上架」发 Slack
3. 消费级显卡零售价：有 Keepa key 再加，不要先上 streetmerchant
