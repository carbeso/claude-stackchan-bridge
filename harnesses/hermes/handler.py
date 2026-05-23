import http.client
import json
import os

# Bridge Server 的連線資訊
BRIDGE_URL = "127.0.0.1"
BRIDGE_PORT = 7331

def trigger_action(action):
    """
    向 StackChan Bridge 發送觸發指令
    """
    try:
        conn = http.client.HTTPConnection(BRIDGE_URL, BRIDGE_PORT, timeout=2)
        headers = {'Content-Type': 'application/json'}
        data = json.dumps({"action": action})
        conn.request("POST", "/action", data, headers)
        response = conn.getresponse()
        response.read()
        conn.close()
    except Exception as e:
        # 即使 Bridge 沒啟動，也不要中斷 Agent 的執行
        print(f"StackChan Bridge 呼叫失敗: {e}")

async def handle(event_type: str, context: dict):
    """
    Hermes Agent 事件 Hook 處理器

    支援事件包括: agent:start, agent:end, agent:step, command:run:pre, command:run:post 等。
    此函數將 Hermes 的生命週期事件映射到 StackChan 的對應動作。
    """

    # 事件與動作的映射表
    event_map = {
        "agent:start": "startup",    # Agent 啟動
        "agent:end": "done",         # 任務完成
        "agent:step": "thinking",    # 思考/步驟切換
        "command:run:pre": "tool",   # 準備執行工具
        "command:run:post": "working", # 工具執行完畢，恢復工作狀態
        "error": "error"             # 發生錯誤
    }

    action = event_map.get(event_type)
    if action:
        trigger_action(action)

    # 額外邏輯：若指令執行失敗（Exit Code != 0），觸發錯誤動作
    if event_type == "command:run:post":
        if context.get("exit_code") != 0:
            trigger_action("error")
