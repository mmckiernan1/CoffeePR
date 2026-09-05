CREATE TRIGGER IF NOT EXISTS `pilot_approval_snapshot_after_payment_state_update`
AFTER UPDATE OF `state_json` ON `pilot_uat_states`
WHEN
  NEW.`id` LIKE 'PAY-UAT-%'
  AND json_extract(NEW.`state_json`, '$.approved') = 1
  AND json_extract(NEW.`state_json`, '$.approvedFingerprint') IS NOT NULL
  AND json_array_length(json_extract(NEW.`state_json`, '$.approvalHistory')) > 0
  AND (
    json_extract(OLD.`state_json`, '$.approved') != 1
    OR json_extract(OLD.`state_json`, '$.approvedFingerprint') IS NOT json_extract(NEW.`state_json`, '$.approvedFingerprint')
  )
BEGIN
  INSERT OR IGNORE INTO `pilot_approval_snapshots` (
    `id`,
    `workspace_id`,
    `run_key`,
    `fingerprint`,
    `period_start`,
    `period_end`,
    `pay_date`,
    `province`,
    `frequency`,
    `employee_count`,
    `snapshot_json`,
    `approved_at`,
    `approved_by`
  )
  SELECT
    json_extract(snapshot.`value`, '$.snapshotId'),
    NEW.`workspace_id`,
    json_extract(snapshot.`value`, '$.run.runKey'),
    json_extract(snapshot.`value`, '$.fingerprint'),
    json_extract(snapshot.`value`, '$.run.periodStart'),
    json_extract(snapshot.`value`, '$.run.periodEnd'),
    json_extract(snapshot.`value`, '$.run.payDate'),
    json_extract(snapshot.`value`, '$.profile.province'),
    json_extract(snapshot.`value`, '$.profile.frequency'),
    json_array_length(json_extract(snapshot.`value`, '$.employees')),
    snapshot.`value`,
    json_extract(snapshot.`value`, '$.approvedAt'),
    json_extract(snapshot.`value`, '$.approvedBy')
  FROM json_each(json_extract(NEW.`state_json`, '$.approvalHistory')) AS snapshot
  ORDER BY CAST(snapshot.`key` AS INTEGER) DESC
  LIMIT 1;
END;
