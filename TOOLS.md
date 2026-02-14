# TOOLS.md - Local Notes

## SSH Hosts

| 别名 | IP | 用户 | 密钥 | 用途 |
|------|-----|------|------|------|
| fr.ovh | 37.187.31.49 | debian | ~/id_rsa.pem | 生产环境 |
| ge.ovh | 51.75.146.33 | debian | ~/.ssh/dev_ovh_rsa.pem | 开发环境 |

- 两台都是 debian 用户 + 私钥登录，sudo 免密码
- ge.ovh ↔ fr.ovh 已配置互相 SSH alias（debian 用户 ed25519 密钥），可直接 `ssh fr.ovh` / `ssh ge.ovh`

## API Endpoints

- n8n: `https://n8n.xiai.xyz/api/v1` (key in env: N8N_API_KEY)
- Tavily: key in env: TAVILY_API_KEY
- OpenAI: key in env: OPENAI_API_KEY
- FizzRead Search: `GET www.fizzread.ai/api/v1/book/search`
- FizzRead Preview: `GET www.fizzread.ai/api/v1/book/preview`

## Services

- n8n 机器: 23.80.90.84 (n8n.xiai.xyz via Cloudflare)
- GSC Service Account: `fizzread-indexing@gen-lang-client-0589157348.iam.gserviceaccount.com`
- GSC Key: fr.ovh `/root/projects/fizzread-seo/config/gsc-service-account.json`
- MopTools/Semrush: app.moptools.com (fizz/fizz1234, 到期 2026-03-05)

## Telegram

- Bot: @openclawpt_mac_bot
- 主人 Chat ID: 1149648904

## 凭证汇总

详见 `credentials.md`（仅 Mac 本地）
