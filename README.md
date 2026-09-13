# Intel Hub

黄金 / 云 GPU / 翻新 Mac mini 实时情报看板。

- 线上：https://intel-hub-six.vercel.app
- 仓库：https://github.com/zmt18928708528-eng/intel-hub

公开接口适配器归一成同一份 `Quote`，带网页看板、JSON API 和 CLI。源站失败时用 Stooq / RunPod / 仓库快照补齐，避免空白页。

## 看板能做什么

- **黄金**：Yahoo `GC=F` COMEX + gold-api.com 现货 + currency-api 人民币克价 + CoinGecko PAXG；Yahoo 限流时用快照补齐
- **显卡**：gputracker 云租最低价 + RunPod GraphQL 对照 + NVIDIA Partner Search + `NVDA`
- **Mac mini**：Apple 翻新页 JSON-LD / bootstrap；缺货时给出官方链接与 MSRP + `AAPL`
- 星标关注（浏览器本地）、型号筛选、搜索、90 秒自动刷新、`GET /api/intel`
- GitHub Actions 每 30 分钟写 `data/latest.json`（`[skip ci]`，不触发 Vercel 重建）

没有做账号体系、历史库、整站爬虫。零售库存继续优先 Keepa / 官方接口。

## 本地运行

需要 Node 22+。

```bash
git clone https://github.com/zmt18928708528-eng/intel-hub.git
cd intel-hub
npm install
npm run dev
```

CLI：

```bash
npm run all
npm run gold
npm run gpu
npm run macmini
npm run intel -- all --json
```

JSON API：`GET /api/intel`，可选 `?only=gold|gpu|macmini`。

## 环境变量（可选）

不要提交 `.env`。在 Vercel 项目设置里加：

| 变量 | 作用 |
| --- | --- |
| `GOLDAPI_KEY` | 打开 GoldAPI.io 现货路径 |
| `NVIDIA_LOCALE` | NVIDIA 目录地区，默认 `en-us` |

## 部署

GitHub `main` 已连接 Vercel production。应用代码 push 会自动构建；快照 commit 带 `[skip ci]`，不会反复占用 Hobby 构建额度。
