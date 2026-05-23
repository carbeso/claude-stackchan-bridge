import http.client
import json
import os

BRIDGE_URL = "127.0.0.1"
BRIDGE_PORT = 7331

def trigger_action(action):
    try:
        conn = http.client.HTTPConnection(BRIDGE_URL, BRIDGE_PORT, timeout=2)
        headers = {'Content-Type': 'application/json'}
        data = json.dumps({"action": action})
        conn.request("POST", "/action", data, headers)
        response = conn.getresponse()
        response.read()
        conn.close()
    except Exception as e:
        # We don't want to crash the agent if the bridge is down
        print(f"StackChan Bridge Error: {e}")

async def handle(event_type: str, context: dict):
    """
    Hermes Event Hook Handler
    Supported events: agent:start, agent:end, agent:step, command:*, etc.
    """

    # Mapping Hermes events to StackChan actions
    event_map = {
        "agent:start": "startup",
        "agent:end": "done",
        "agent:step": "thinking",
        "command:run:pre": "tool",
        "command:run:post": "working",
        "error": "error"
    }

    action = event_map.get(event_type)
    if action:
        trigger_action(action)

    # Wildcard for command failures if event_type is command:run:post and exit_code != 0
    if event_type == "command:run:post":
        if context.get("exit_code") != 0:
            trigger_action("error")
