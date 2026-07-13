# Recovery evidence

Frozen selection:

```sql
SELECT task_id FROM tasks
WHERE task_id LIKE 'task-s1-%'
ORDER BY task_id;
```

Digest: `4fd18c593577279332bae187d1b470185896cd5cdd20707318b88350e247bbc5`, count: `2806`.

The recovery used exported `openControlPlaneDb`, `withImmediateTransaction` and `auditEvent`; it updated only the frozen IDs and wrote audit event `incident.s1_tasks_cancelled`. Final structured status summary: `cancelled=2806`.
