# 8C.DEMO — Data Audit (2026-07-11)

Remote Supabase counts at implementation time.

| Stage | Count | Status |
|-------|------:|--------|
| fire_detections (observaciones) | 97 | has_real_data |
| fire_events | 14 | has_real_data |
| composite_findings | 50 | has_real_data |
| finding_priority_assessments | 11 | has_real_data |
| incidents (total) | 4 | legacy_only (0 tenant-owned) |
| event_lifecycle_transitions | 12 | has_real_data |
| verification_plans | 4 | has_real_data |
| verification_needs | 0 | empty |
| missions | 2 | pilot_only (Field Sync Pilot) |
| evidence_submissions | 1 | pilot_only |
| evidence_validations | 0 | empty |
| verification_need_resolutions | 0 | empty |
| response_assessments | 0 | empty (not connected to UI data yet) |
| decision_records | 0 | empty |
| response_actions | 0 | empty |

## Recommended demo incident

`8cd9487a-6823-43d6-b186-3166165db05a` — **Cobertura: 6 de 9 etapas**

Present: event, finding, priority, lifecycle, plan, mission, evidence  
Missing: resolution, response assessment, decision

## Demo internal mode

Pilot missions tagged `Field Sync Pilot — Internal Verification`.  
Visible only with **Mostrar demostraciones** toggle.  
Excluded from national statistics by default.
