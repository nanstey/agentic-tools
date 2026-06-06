---
id: make-it-fast
category: Process and Optimization
category_id: process-and-optimization
priority_level: 12
---

# Make It Fast

## What It Means

Optimize performance after correctness and quality are validated, and based on measurements.

## Apply When

- Users experience observable latency or resource-cost issues.
- Profiling identifies clear hotspots in stable flows.

## Good vs Bad

- Good: optimize measured bottlenecks with behavior-preserving checks.
- Bad: speculative micro-optimization before evidence.

## Tradeoffs and Conflicts

- Can conflict with `make-it-work` and `kiss`.
- Tie-break default: defer optimization until instrumentation confirms impact.

## Actionable Playbook

- Require a clear performance objective first (latency, throughput, memory, or cost).
- Verify baseline measurement and dominant bottleneck identification before optimization.
- Check hotspot optimizations include behavior-preserving tests and benchmark comparison.
- Treat optimization as complete when target is met or gains flatten; flag added complexity beyond target value.

## References

- C2: "Make It Work, Make It Right, Make It Fast"
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
