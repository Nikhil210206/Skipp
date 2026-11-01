"""Audit and access logging for Skipp.

Provides clean, arranged, human-readable logging for Render and stdout,
and maintains an in-memory ring buffer of recent student access events for
the /activity dashboard.

Security / Privacy:
- NEVER logs passwords or raw credentials.
- Records student identity (name, net ID, section), action performed, outcome status,
  latency, and origin IP.
"""
from __future__ import annotations

import html
import logging
import os
import time
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

log = logging.getLogger("skipp.audit")

# Indian Standard Time (UTC+5:30) for SRMIST campus context
IST = timezone(timedelta(hours=5, minutes=30))

# Ring buffer for the most recent 200 student access events
_MAX_HISTORY = 200
_history: deque[dict[str, Any]] = deque(maxlen=_MAX_HISTORY)


def record_activity(
    action: str,
    username: str,
    student_name: Optional[str] = None,
    section: Optional[str] = None,
    status: str = "SUCCESS",
    status_code: int = 200,
    details: Optional[str] = None,
    duration_s: float = 0.0,
    ip: str = "unknown",
) -> dict[str, Any]:
    """Record an access event cleanly in Render stdout and in-memory history."""
    now_ist = datetime.now(IST)
    time_str = now_ist.strftime("%d %b %Y, %I:%M:%S %p IST")
    time_short = now_ist.strftime("%I:%M:%S %p")

    clean_user = (username or "").strip()
    if "@" in clean_user:
        clean_user = clean_user.split("@")[0].strip()

    name_display = student_name.strip() if student_name else None

    # Status icon / badge
    if status_code < 400:
        badge = "SUCCESS"
        icon = "✅"
    elif status_code < 500:
        badge = "WARN"
        icon = "⚠️"
    else:
        badge = "FAILED"
        icon = "❌"

    entry: dict[str, Any] = {
        "timestamp": time_str,
        "time_short": time_short,
        "iso_timestamp": now_ist.isoformat(),
        "action": action,
        "username": clean_user or "anonymous",
        "student_name": name_display,
        "section": section or "-",
        "status": status,
        "status_code": status_code,
        "badge": badge,
        "details": details or "",
        "duration_s": round(duration_s, 2),
        "ip": ip,
    }

    _history.appendleft(entry)

    # Build arranged single-line string for Render log console:
    # Example:
    # [ACCESS] 👤 NIKHIL BALAMURUGAN (NetID: ab1234 | Sec: E2) | 🎯 Academia Refresh | ✅ 200 SUCCESS: 8 courses, Att: GATED, Marks: READY | ⏱️ 1.45s | 🌐 IP: 103.xxx
    who_parts = []
    if name_display:
        who_parts.append(name_display)
    if clean_user:
        who_parts.append(f"NetID: {clean_user}")
    if section and section != "-":
        who_parts.append(f"Sec: {section}")

    who_str = " | ".join(who_parts) if who_parts else "Unknown Student"
    detail_str = f": {details}" if details else ""

    log.info(
        "[ACCESS] 👤 %s | 🎯 %s | %s %d %s%s | ⏱️ %.2fs | 🌐 IP: %s",
        who_str,
        action,
        icon,
        status_code,
        status,
        detail_str,
        duration_s,
        ip,
    )

    return entry


def get_activity_history(limit: int = 100) -> list[dict[str, Any]]:
    """Return the recent activity log list."""
    return list(_history)[:limit]


def render_activity_html(admin_key_configured: bool = False) -> str:
    """Render a clean, high-contrast dark-theme HTML activity dashboard."""
    entries = list(_history)
    total_count = len(entries)
    success_count = sum(1 for e in entries if e["status_code"] < 400)
    failed_count = sum(1 for e in entries if e["status_code"] >= 400)

    rows = []
    for e in entries:
        sc = e["status_code"]
        if sc < 400:
            badge_class = "badge-success"
            badge_icon = "✓"
        elif sc < 500:
            badge_class = "badge-warning"
            badge_icon = "!"
        else:
            badge_class = "badge-error"
            badge_icon = "✕"

        student = html.escape(e["student_name"] or "—")
        user = html.escape(e["username"])
        sec = html.escape(e["section"])
        act = html.escape(e["action"])
        det = html.escape(e["details"])
        dur = f"{e['duration_s']}s"
        ip = html.escape(e["ip"])
        t = html.escape(e["timestamp"])

        rows.append(f"""
        <tr>
            <td class="time-col">{t}</td>
            <td class="student-col">
                <div class="student-name">{student}</div>
                <div class="student-meta">{user} {f'• Sec {sec}' if sec != '-' else ''}</div>
            </td>
            <td class="action-col"><span class="action-tag">{act}</span></td>
            <td class="status-col">
                <span class="badge {badge_class}">{badge_icon} {sc} {html.escape(e['status'])}</span>
                {f'<div class="details-text">{det}</div>' if det else ''}
            </td>
            <td class="dur-col">{dur}</td>
            <td class="ip-col">{ip}</td>
        </tr>
        """)

    table_body = "\n".join(rows) if rows else "<tr><td colspan='6' class='empty-row'>No activity recorded yet. Events will appear here live when students log in.</td></tr>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skipp — Access & Login Activity</title>
    <style>
        :root {{
            --bg: #0b0c10;
            --surface: #14161f;
            --surface-hover: #1c1e2b;
            --border: #232738;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent: #8b5cf6;
            --accent-glow: rgba(139, 92, 246, 0.15);
            --green: #10b981;
            --green-bg: rgba(16, 185, 129, 0.12);
            --amber: #f59e0b;
            --amber-bg: rgba(245, 158, 11, 0.12);
            --red: #ef4444;
            --red-bg: rgba(239, 68, 68, 0.12);
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: var(--bg);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            padding: 24px 32px;
            min-height: 100vh;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 16px;
        }}
        .title-group {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo {{
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            color: white;
            font-weight: 800;
            font-size: 18px;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px var(--accent-glow);
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }}
        .subtitle {{
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 2px;
        }}
        .stats-bar {{
            display: flex;
            gap: 16px;
        }}
        .stat-card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 16px;
            min-width: 100px;
        }}
        .stat-val {{
            font-size: 18px;
            font-weight: 700;
            color: var(--text-main);
        }}
        .stat-lbl {{
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
        }}
        .controls {{
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            align-items: center;
            flex-wrap: wrap;
        }}
        .search-box {{
            flex: 1;
            min-width: 240px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 14px;
            color: var(--text-main);
            font-size: 14px;
            outline: none;
            transition: border-color 0.15s ease;
        }}
        .search-box:focus {{
            border-color: var(--accent);
        }}
        .refresh-btn {{
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.15s ease;
        }}
        .refresh-btn:hover {{
            background: var(--surface-hover);
        }}
        .auto-refresh {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: var(--text-muted);
            cursor: pointer;
        }}
        .table-wrap {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow-x: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }}
        th {{
            background: rgba(255,255,255,0.02);
            color: var(--text-muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            font-weight: 600;
        }}
        td {{
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }}
        tr:last-child td {{
            border-bottom: none;
        }}
        tr:hover td {{
            background: var(--surface-hover);
        }}
        .time-col {{
            white-space: nowrap;
            color: var(--text-muted);
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px;
        }}
        .student-name {{
            font-weight: 600;
            color: #fff;
        }}
        .student-meta {{
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
            font-family: ui-monospace, monospace;
        }}
        .action-tag {{
            background: var(--accent-glow);
            color: #c4b5fd;
            border: 1px solid rgba(139, 92, 246, 0.3);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
        }}
        .badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }}
        .badge-success {{
            background: var(--green-bg);
            color: var(--green);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}
        .badge-warning {{
            background: var(--amber-bg);
            color: var(--amber);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }}
        .badge-error {{
            background: var(--red-bg);
            color: var(--red);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}
        .details-text {{
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 4px;
        }}
        .dur-col {{
            font-family: ui-monospace, monospace;
            color: var(--text-muted);
            white-space: nowrap;
        }}
        .ip-col {{
            font-family: ui-monospace, monospace;
            font-size: 12px;
            color: var(--text-muted);
            white-space: nowrap;
        }}
        .empty-row {{
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title-group">
            <div class="logo">S</div>
            <div>
                <h1>Skipp Access & Login Activity</h1>
                <div class="subtitle">Live arranged audit stream for students accessing SRM portals</div>
            </div>
        </div>
        <div class="stats-bar">
            <div class="stat-card">
                <div class="stat-val">{total_count}</div>
                <div class="stat-lbl">Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-val" style="color: var(--green);">{success_count}</div>
                <div class="stat-lbl">Successful</div>
            </div>
            <div class="stat-card">
                <div class="stat-val" style="color: var(--red);">{failed_count}</div>
                <div class="stat-lbl">Failed</div>
            </div>
        </div>
    </div>

    <div class="controls">
        <input type="text" id="searchInput" class="search-box" placeholder="Filter by student name, NetID, section, or action..." oninput="filterTable()">
        <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
        <label class="auto-refresh">
            <input type="checkbox" id="autoRefreshToggle" onchange="toggleAutoRefresh(this.checked)"> Auto-refresh (5s)
        </label>
    </div>

    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Time (IST)</th>
                    <th>Student</th>
                    <th>Action</th>
                    <th>Status & Outcome</th>
                    <th>Latency</th>
                    <th>IP</th>
                </tr>
            </thead>
            <tbody id="tableBody">
                {table_body}
            </tbody>
        </table>
    </div>

    <script>
        function filterTable() {{
            const filter = document.getElementById('searchInput').value.toLowerCase();
            const rows = document.querySelectorAll('#tableBody tr');
            rows.forEach(row => {{
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            }});
        }}

        let timer = null;
        function toggleAutoRefresh(enabled) {{
            if (timer) clearInterval(timer);
            if (enabled) {{
                timer = setInterval(() => {{
                    // Only reload if user isn't typing in search
                    if (!document.getElementById('searchInput').matches(':focus')) {{
                        location.reload();
                    }}
                }}, 5000);
            }}
        }}
        // Auto-refresh is disabled by default
        toggleAutoRefresh(false);
    </script>
</body>
</html>
"""
