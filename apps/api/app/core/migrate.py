"""Lightweight schema evolution: add missing columns on startup.

Keeps SQLite/Postgres dev databases forward-compatible without full Alembic
setup — new model columns are ALTER-ed in automatically.
"""

from __future__ import annotations

from sqlalchemy import inspect, text


def ensure_columns(conn) -> None:  # sync connection
    from app.core.db import Base

    insp = inspect(conn)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            col_type = col.type.compile(conn.dialect)  # type: ignore[arg-type]
            null = "NULL" if col.nullable else "NULL"  # safe default for evolution
            default = ""
            if col.default is not None and getattr(col.default, "arg", None) is not None:
                arg = col.default.arg
                if isinstance(arg, (int, float)):
                    default = f" DEFAULT {arg}"
                elif isinstance(arg, str):
                    default = f" DEFAULT '{arg}'"
            conn.execute(
                text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{null}{default}')
            )
