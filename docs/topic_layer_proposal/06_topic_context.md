
# Topic Context for Task Engine

Instead of passing topic_id only, pass topic_context.

Example:

{
  topic_id: "topic:ionic_bond",
  allowed_examples: ["NaCl","KBr"],
  preferred_templates: ["tmpl.bonds.determine_type.v1"],
  difficulty_range: [0.2,0.5]
}

Benefits:

- better example selection
- topic-specific tasks
- natural prompts
