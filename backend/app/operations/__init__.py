"""Operational primitives that do not mutate production state in place.

Import concrete operations from their modules.  Keeping package import free
of eager side effects also permits clean ``python -m`` CLI execution.
"""
