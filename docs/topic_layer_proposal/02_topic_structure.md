
# Topic Core Structure

Minimal Topic schema:

id
course_unit_kind
title
summary
competency_ids
theory_refs
example_refs
task_template_ids
related_topic_ids

Important rule:

References to theory modules should use:

module + section_id
optional block_id

Never use positional indexes like block_idx.
