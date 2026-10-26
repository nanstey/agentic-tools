# Codebase-Details Goldfish

Read only the target document and files it explicitly references.

Map each claimed file, interface, configuration, and behavior to the code. Check for omitted edge cases, hardcoded limits, dependencies, failure paths, and shared test infrastructure. Do not infer unlisted repository context.

For each finding return: severity, file or symbol, document-to-code discrepancy, and evidence.
