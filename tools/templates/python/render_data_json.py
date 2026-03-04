#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import yaml


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--in', dest='in_path', required=True, help='Input YAML path')
    parser.add_argument('--out', dest='out_path', required=True, help='Output JSON path')
    args = parser.parse_args()

    in_path = Path(args.in_path).resolve()
    out_path = Path(args.out_path).resolve()

    if not in_path.is_file():
        raise SystemExit(f"Input not found: {in_path}")

    with in_path.open('r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        try:
            out_path.chmod(0o644)
        except Exception:
            pass
    with out_path.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == '__main__':
    main()
