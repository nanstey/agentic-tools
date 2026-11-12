# Agent Comment Disclosure

For content posted under the user's GitHub identity, start with exactly:

```markdown
> [!NOTE]
> 🤖 Written by <User>'s Agent

<body>
```

Resolve `<User>` with `gh api user -q .login`, unless the user stated a name.

Apply this rule to comments, review bodies, inline comments, and thread replies. Do not apply it to commit messages, PR titles, code, or PR and issue descriptions, unless a workflow already treats a description as a comment.
