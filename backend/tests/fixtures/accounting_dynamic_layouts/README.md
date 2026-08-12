# Dynamic accounting acceptance fixtures

Task 8 does not store workbook binaries in the repository. The synthetic acceptance app
generates every workbook below its caller-provided temporary directory and removes that
directory when the acceptance process exits.

The generated matrix covers renamed files, multiple sheets, merged and two-row headers,
title/section/auxiliary rows, numeric text, ambiguous amount columns, deterministic
validation failure, and a malicious cell instruction. A separate synthetic Tool Loop case
forces the primary tool to report `tool_unavailable` and verifies an authorized alternate
tool succeeds with linked audit references.

All values are invented test data. No production path, credential, external network, macro,
external link, or real financial record is used.
