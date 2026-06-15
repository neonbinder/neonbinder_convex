# Security Auditor Memory Index

- [terraform_audit_summary.md](terraform_audit_summary.md) - Summary of Terraform infrastructure security audit findings (2026-03-18)
- [patterns_testing_endpoint_gate.md](patterns_testing_endpoint_gate.md) - E2E sign-in/seed/reset gating (6-layer); updateSiteCredentialStatus is a flag-only public mutation NOT test-gated (flag-vs-storage divergence risk)
- [patterns_selector_options_admin_model.md](patterns_selector_options_admin_model.md) - SetSelector/selectorOptions = admin-only global taxonomy (no IDOR); requireAdmin IS the prod fail-closed gate; getSelectorSyncStatus un-gated query renders raw error msg (info-leak class)
