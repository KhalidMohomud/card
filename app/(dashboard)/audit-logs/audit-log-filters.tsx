"use client";

import Form from "next/form";
import { ChevronDown } from "lucide-react";
import styles from "./audit-logs.module.css";

type AuditLogFiltersProps = { actions: string[]; entities: string[]; selectedAction: string; selectedEntity: string };

function readableLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AuditLogFilters({ actions, entities, selectedAction, selectedEntity }: AuditLogFiltersProps) {
  const submit = (event: React.ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  return <Form action="/audit-logs" className={styles.filterForm}>
    <label className={styles.selectControl}>
      <span className={styles.srOnly}>Filter by action</span>
      <select name="action" defaultValue={selectedAction} onChange={submit} aria-label="Filter by action"><option value="">All actions</option>{actions.map((action) => <option key={action} value={action}>{readableLabel(action)}</option>)}</select>
      <ChevronDown size={17} aria-hidden="true" />
    </label>
    <label className={styles.selectControl}>
      <span className={styles.srOnly}>Filter by entity</span>
      <select name="entity" defaultValue={selectedEntity} onChange={submit} aria-label="Filter by entity"><option value="">All entities</option>{entities.map((entity) => <option key={entity} value={entity}>{readableLabel(entity)}</option>)}</select>
      <ChevronDown size={17} aria-hidden="true" />
    </label>
  </Form>;
}
