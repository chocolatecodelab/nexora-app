"""
Tests for Nexora AI — SSE Task Event Streamer (event_stream)
"""

import asyncio
import json
import pytest
from app.services.event_stream import (
    broadcast_task_event,
    event_generator,
    format_sse_message,
    _subscribers,
)


def test_format_sse_message():
    data = {"status": "implementing", "progress": 50}
    msg = format_sse_message("status_update", data)
    assert msg.startswith("event: status_update\n")
    assert 'data: {"status": "implementing", "progress": 50}\n\n' in msg


@pytest.mark.anyio
async def test_broadcast_and_receive_event():
    task_id = "test-task-123"

    # Start generator in background task
    gen = event_generator(task_id, request=None)

    # First event yielded should be 'init'
    init_msg = await gen.asend(None)
    assert "event: init\n" in init_msg or ": keep-alive" in init_msg

    # Broadcast custom event
    custom_payload = {"phase": "coder", "file": "src/App.tsx"}
    notified = broadcast_task_event(task_id, "tool_call", custom_payload)
    assert notified >= 1

    # Receive broadcasted event from generator
    received_msg = await gen.asend(None)
    assert "event: tool_call\n" in received_msg
    assert '"file": "src/App.tsx"' in received_msg

    # Close generator
    await gen.aclose()
    assert task_id not in _subscribers or len(_subscribers[task_id]) == 0
