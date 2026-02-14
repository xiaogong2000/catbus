#!/bin/bash
# sync-claude.sh — 双向同步 .claude/ 目录
# 共享源: fr.ovh:/root/projects/fizzread-seo/.claude/
# 用法: sync-claude.sh

set -e

# 配置
REMOTE_HOST="fr.ovh"
REMOTE_DIR="/root/projects/fizzread-seo/.claude"
SYNC_FILES="CLAUDE.md TASK.md PROGRESS.md DECISIONS.md ENV-GUIDE.md"

# 检测本机环境
detect_local_dir() {
  if [ -d "/root/projects/fizzread-seo/.claude" ]; then
    echo "/root/projects/fizzread-seo/.claude"
  elif [ -d "$HOME/.openclaw/workspace" ]; then
    echo "$HOME/.openclaw/workspace/.claude"
  else
    echo ""
  fi
}

LOCAL_DIR=$(detect_local_dir)
if [ -z "$LOCAL_DIR" ]; then
  echo "❌ 找不到本地 .claude/ 目录"
  exit 1
fi

# 确保本地目录存在
mkdir -p "$LOCAL_DIR"

HOSTNAME=$(hostname)
echo "🔄 同步 .claude/ | 本机: $HOSTNAME | 共享源: $REMOTE_HOST"
echo "   本地: $LOCAL_DIR"
echo "   远程: $REMOTE_HOST:$REMOTE_DIR"
echo ""

PULLED=0
PUSHED=0
SKIPPED=0

for FILE in $SYNC_FILES; do
  LOCAL_FILE="$LOCAL_DIR/$FILE"
  REMOTE_FILE="$REMOTE_DIR/$FILE"

  # 获取远程文件修改时间 (epoch)
  REMOTE_MTIME=$(ssh "$REMOTE_HOST" "sudo stat -c %Y '$REMOTE_FILE' 2>/dev/null || echo 0")

  # 获取本地文件修改时间 (epoch)
  if [ -f "$LOCAL_FILE" ]; then
    # macOS 和 Linux 的 stat 语法不同
    if [[ "$(uname)" == "Darwin" ]]; then
      LOCAL_MTIME=$(stat -f %m "$LOCAL_FILE" 2>/dev/null || echo 0)
    else
      LOCAL_MTIME=$(stat -c %Y "$LOCAL_FILE" 2>/dev/null || echo 0)
    fi
  else
    LOCAL_MTIME=0
  fi

  # 比较并同步
  if [ "$REMOTE_MTIME" -eq 0 ] && [ "$LOCAL_MTIME" -eq 0 ]; then
    # 两边都没有
    continue
  elif [ "$LOCAL_MTIME" -eq 0 ]; then
    # 本地没有，从远程拉
    echo "  ⬇ PULL  $FILE (本地不存在)"
    ssh "$REMOTE_HOST" "sudo cat '$REMOTE_FILE'" > "$LOCAL_FILE"
    PULLED=$((PULLED + 1))
  elif [ "$REMOTE_MTIME" -eq 0 ]; then
    # 远程没有，推到远程
    echo "  ⬆ PUSH  $FILE (远程不存在)"
    cat "$LOCAL_FILE" | ssh "$REMOTE_HOST" "sudo tee '$REMOTE_FILE' > /dev/null"
    PUSHED=$((PUSHED + 1))
  elif [ "$REMOTE_MTIME" -gt "$LOCAL_MTIME" ]; then
    # 远程更新
    echo "  ⬇ PULL  $FILE (远程更新: +$((REMOTE_MTIME - LOCAL_MTIME))s)"
    ssh "$REMOTE_HOST" "sudo cat '$REMOTE_FILE'" > "$LOCAL_FILE"
    PULLED=$((PULLED + 1))
  elif [ "$LOCAL_MTIME" -gt "$REMOTE_MTIME" ]; then
    # 本地更新
    echo "  ⬆ PUSH  $FILE (本地更新: +$((LOCAL_MTIME - REMOTE_MTIME))s)"
    cat "$LOCAL_FILE" | ssh "$REMOTE_HOST" "sudo tee '$REMOTE_FILE' > /dev/null"
    PUSHED=$((PUSHED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "✅ 完成 | ⬇ 拉取: $PULLED | ⬆ 推送: $PUSHED | ⏭ 跳过: $SKIPPED"
