# catbus.xyz 前端需求

## 需求 1：节点别名修改

**背景**：当前节点名是自动生成的（如 `node-0ad2fa`），不直观，用户无法识别哪个节点是自己的。

**功能描述**：
- 用户可以给自己的节点设置 alias（显示名称）
- 在 dashboard 节点卡片上加"编辑名称"入口
- 修改后 relay 实时更新，dashboard 立即显示新名称

**实现建议**：
- 节点卡片右上角加编辑图标（铅笔）
- 点击弹出输入框，输入新名称后确认
- 调用 relay API 更新节点 name 字段
- alias 存储在 relay 侧（节点重连时需要带上 node_id，relay 保留 alias）

---

## 需求 2：一键解绑 + 卸载

**背景**：当前解绑流程复杂，用户需要手动 SSH 到机器执行多条命令。

**功能描述**：
- 节点卡片上新增"解绑节点"按钮
- 点击后弹出确认对话框（防误操作）
- 确认后执行：
  1. 向 relay 注销该节点（relay 删除节点记录）
  2. 通过 catbus 向该节点发送卸载指令（停止 daemon + 删除 catbus pip 包）
  3. 节点从 dashboard 消失

**实现建议**：
- relay 新增 `DELETE /api/nodes/{node_id}` 接口
- 卸载指令通过 catbus task 下发：`pip uninstall catbus -y && systemctl stop catbus`
- 卸载成功回调更新 dashboard 状态

---

*记录时间：2026-03-15 09:31 GMT+8*
