from __future__ import annotations
import hashlib
import json
import os
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "direct_cache"
CACHE_TTL_HOURS = 24

@dataclass
class CacheEntry:
    command_hash: str
    result: dict
    mode: str
    created_at: str
    hit_count: int = 0

class DirectCache:
    def __init__(self, cache_dir=CACHE_DIR, ttl_hours=CACHE_TTL_HOURS):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(hours=ttl_hours)
        self._memory_cache = {}
    
    def _hash(self, command):
        return hashlib.md5(command.encode()).hexdigest()
    
    def get(self, command):
        key = self._hash(command)
        # 内存缓存优先
        if key in self._memory_cache:
            entry = self._memory_cache[key]
            if datetime.now() - datetime.fromisoformat(entry.created_at) < self.ttl:
                entry.hit_count += 1
                entry.result["_cache_hit"] = True
                return entry.result
            del self._memory_cache[key]
        # 文件缓存
        path = self.cache_dir / f"{key}.json"
        if path.exists():
            try:
                entry_data = json.loads(path.read_text(encoding="utf-8"))
                created = datetime.fromisoformat(entry_data["created_at"])
                if datetime.now() - created < self.ttl:
                    entry = CacheEntry(**entry_data)
                    entry.hit_count += 1
                    self._memory_cache[key] = entry
                    entry.result["_cache_hit"] = True
                    return entry.result
            except Exception:
                pass
        return None
    
    def set(self, command, result, mode):
        key = self._hash(command)
        entry = CacheEntry(
            command_hash=key,
            result=result,
            mode=mode,
            created_at=datetime.now().isoformat()
        )
        self._memory_cache[key] = entry
        # 持久化
        path = self.cache_dir / f"{key}.json"
        path.write_text(json.dumps({
            "command_hash": entry.command_hash,
            "result": entry.result,
            "mode": entry.mode,
            "created_at": entry.created_at,
            "hit_count": entry.hit_count
        }, ensure_ascii=False), encoding="utf-8")
    
    def clear_expired(self):
        for path in self.cache_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                created = datetime.fromisoformat(data["created_at"])
                if datetime.now() - created > self.ttl:
                    path.unlink()
            except Exception:
                pass
    
    def get_stats(self):
        files = list(self.cache_dir.glob("*.json"))
        total_hits = 0
        for f in files:
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                total_hits += data.get("hit_count", 0)
            except Exception:
                pass
        return {"cached_items": len(files), "total_hits": total_hits}

cache = DirectCache()