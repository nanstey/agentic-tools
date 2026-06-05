# Make It Fast

## Metadata

- `id`: `make-it-fast`
- `category`: `Process and Optimization` (`process-and-optimization`)
- `source`: https://wiki.c2.com/?MakeItWorkMakeItRightMakeItFast
- `priority_level`: `12`

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

## References

- C2: "Make It Work, Make It Right, Make It Fast"
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
