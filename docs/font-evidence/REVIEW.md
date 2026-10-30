# Sol review ledger

Budget: three sequential rounds; one reviewer, no nested agents.
Provider/model/effort verified through T3 capabilities: Codex,
`gpt-6.1-sol`, `reasoningEffort=xhigh`.

Scope: safe full-face font candidate plus manual tools, licensing and observed
proof. The original split/core-preload acceptance gate is explicitly blocked;
review does not waive it. No push or PR yet.

Diff command for every round:
`git diff 7699fef5239c2082baa1ef1b2be8014ff3d02714`.

| Round | State | Findings | Usage |
|---|---|---|---|
| 1 | CHANGES | S1 should: missing/after-only cases could falsely pass. Fixed: require nonempty matching PNG sets before comparison. Six CLI tests pass, four fail before fix; both real 62-case comparisons rerun. | Not returned |
| 2 | Pending | S1 recheck and changed code only | Not returned |

Round 1 diff: 1,063 files / 70,542 insertions. No push or PR; original acceptance gate stays blocked.
