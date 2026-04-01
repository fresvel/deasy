#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any, Dict

import yaml


def load_object(path: Path) -> Any:
    if not path.exists():
        raise SystemExit(f"Archivo no encontrado: {path}")
    suffix = path.suffix.lower()
    if suffix in {".yaml", ".yml"}:
        with path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def collect_schema_field_map(node: Any, field_map: Dict[str, Dict[str, Any]] | None = None) -> Dict[str, Dict[str, Any]]:
    if field_map is None:
        field_map = {}

    if isinstance(node, dict):
        field_code = node.get("x-deasy-field-code")
        if isinstance(field_code, str) and field_code.strip():
            field_map[field_code.strip()] = {
                "data_key": node.get("x-deasy-data-key"),
                "schema": node,
            }
        for value in node.values():
            collect_schema_field_map(value, field_map)
    elif isinstance(node, list):
        for item in node:
            collect_schema_field_map(item, field_map)

    return field_map


def set_nested_value(target: Dict[str, Any], dotted_path: str, value: Any) -> None:
    parts = [segment for segment in str(dotted_path).split(".") if segment]
    if not parts:
        return
    cursor = target
    for segment in parts[:-1]:
        next_value = cursor.get(segment)
        if not isinstance(next_value, dict):
            next_value = {}
            cursor[segment] = next_value
        cursor = next_value
    cursor[parts[-1]] = value


def resolve_pattern_path(meta_path: Path, pattern_ref: str) -> Path:
    repo_root = meta_path.resolve().parents[2]
    patterns_dir = repo_root / "patterns"
    normalized = str(pattern_ref or "").strip().replace("\\", "/").strip("/")
    candidates = [patterns_dir / f"{normalized}.yaml", patterns_dir / normalized / "pattern.yaml"]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise SystemExit(f"No se encontro el pattern_ref declarado en meta.yaml: {pattern_ref}")


def merge_runtime_payload(
    base_payload: Dict[str, Any],
    schema: Dict[str, Any],
    meta: Dict[str, Any],
    runtime_values: Dict[str, Any],
    meta_path: Path,
) -> Dict[str, Any]:
    merged = dict(base_payload or {})
    field_map = collect_schema_field_map(schema)
    signatures = (((meta or {}).get("workflows") or {}).get("signatures") or {})
    pattern_ref = signatures.get("pattern_ref")
    if not pattern_ref:
        return merged

    pattern = load_object(resolve_pattern_path(meta_path, pattern_ref))
    compiler_contract = ((pattern or {}).get("pattern") or {}).get("compiler_contract") or {}
    runtime_fields = compiler_contract.get("runtime_fields") or []

    for runtime_field in runtime_fields:
        slot = runtime_field.get("slot")
        if not slot:
            continue
        slot_values = ((runtime_values or {}).get("signatures") or {}).get(slot) or {}
        if not isinstance(slot_values, dict):
            continue
        for runtime_key, field_ref_key in (
            ("token", "token_field_ref"),
            ("nombre", "name_field_ref"),
            ("cargo", "role_field_ref"),
            ("fecha", "date_field_ref"),
        ):
            field_ref = runtime_field.get(field_ref_key)
            if not field_ref:
                continue
            value = slot_values.get(runtime_key)
            if value is None:
                continue
            field_info = field_map.get(field_ref) or {}
            data_key = field_info.get("data_key")
            if isinstance(data_key, str) and data_key.strip():
                merged[data_key] = value
            set_nested_value(merged, field_ref, value)

    return merged


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Ruta de data.yaml/data.json base")
    parser.add_argument("--meta", required=True, help="Ruta de meta.yaml")
    parser.add_argument("--schema", required=True, help="Ruta de schema.json")
    parser.add_argument("--runtime", required=True, help="Ruta del JSON/YAML con valores runtime")
    parser.add_argument("--out", required=True, help="Ruta de salida JSON")
    args = parser.parse_args()

    data = load_object(Path(args.data).resolve())
    meta = load_object(Path(args.meta).resolve())
    schema = load_object(Path(args.schema).resolve())
    runtime = load_object(Path(args.runtime).resolve())

    merged = merge_runtime_payload(
        base_payload=data,
        schema=schema,
        meta=meta,
        runtime_values=runtime,
        meta_path=Path(args.meta).resolve(),
    )

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(merged, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
