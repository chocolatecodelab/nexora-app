"""
Nexora AI — Server-Sent Events (SSE) Task Event Streamer

Provides real-time event broadcasting between backend agent orchestration
and the Next.js frontend workstation:
1. In-memory Pub/Sub message queues mapped by `task_id`
2. SSE formatting conforming to W3C EventSource standard
3. Heartbeat ping generator to keep proxy/Cloud Run connections alive
4. Automatic cleanup on client disconnection
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator, Optional
from fastapi import Request
from app.services import supabase_client

logger = logging.getLogger(__name__)

# Registry of active subscriber queues: task_id -> set of asyncio.Queue
_subscribers: dict[str, set[asyncio.Queue]] = {}


def _get_or_create_subscribers(task_id: str) -> set[asyncio.Queue]:
    """Get or initialize the set of subscriber queues for a given task."""
    if task_id not in _subscribers:
        _subscribers[task_id] = set()
    return _subscribers[task_id]


def format_sse_message(event: str, data: dict | str) -> str:
    """Format a message string adhering to standard SSE syntax."""
    payload = json.dumps(data) if isinstance(data, dict) else str(data)
    return f"event: {event}\ndata: {payload}\n\n"


def broadcast_task_event(task_id: str, event: str, data: dict) -> int:
    """
    Broadcast an event to all connected listeners for a given task_id.
    Returns the number of subscribers notified.
    """
    subs = _subscribers.get(task_id)
    if not subs:
        return 0

    formatted = format_sse_message(event, data)
    dispatched = 0

    for queue in list(subs):
        try:
            queue.put_nowait(formatted)
            dispatched += 1
        except Exception as exc:
            logger.debug("Failed to put event into queue for task %s: %s", task_id, exc)

    logger.debug("Broadcast event '%s' for task %s to %d subscribers", event, task_id, dispatched)
    return dispatched


async def event_generator(task_id: str, request: Optional[Request] = None) -> AsyncGenerator[str, None]:
    """
    Async generator yielding Server-Sent Events for a client connection:
    1. Sends initial state snapshot ('init')
    2. Listens to task event queue
    3. Emits periodic heartbeat comments
    4. Cleans up subscriber on disconnect
    """
    queue: asyncio.Queue = asyncio.Queue()
    subs = _get_or_create_subscribers(task_id)
    subs.add(queue)

    logger.info("SSE client connected to task %s (total listeners: %d)", task_id, len(subs))

    try:
        # 1. Send initial state snapshot
        task = supabase_client.get_task(task_id)
        if task:
            runs = supabase_client.list_agent_runs(task_id)
            tc_map: dict[str, list[dict]] = {}
            for r in runs:
                tc_map[r["id"]] = supabase_client.list_tool_calls(r["id"])

            init_payload = {
                "task": task,
                "runs": runs,
                "tool_calls": tc_map,
            }
            yield format_sse_message("init", init_payload)

        # 2. Main event loop with heartbeat
        while True:
            # Check if client disconnected
            if request and await request.is_disconnected():
                logger.info("SSE client disconnected for task %s", task_id)
                break

            try:
                # Wait for next event or 15s timeout for heartbeat
                msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield msg
            except asyncio.TimeoutError:
                # Heartbeat comment to keep connection alive
                yield ": keep-alive heartbeat\n\n"

    except asyncio.CancelledError:
        logger.info("SSE stream cancelled for task %s", task_id)
    finally:
        # Clean up subscriber
        if task_id in _subscribers and queue in _subscribers[task_id]:
            _subscribers[task_id].remove(queue)
            if not _subscribers[task_id]:
                del _subscribers[task_id]
        logger.info("SSE subscriber removed for task %s", task_id)
