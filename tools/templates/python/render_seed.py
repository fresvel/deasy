#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from pathlib import Path

from jinja2 import Environment, StrictUndefined
import yaml


def is_binary(path: Path) -> bool:
    try:
        with path.open('rb') as f:
            chunk = f.read(2048)
        return b"\0" in chunk
    except Exception:
        return False


def load_defaults(path: Path) -> dict:
    if not path.exists():
        return {}
    if path.suffix in {'.yaml', '.yml'}:
        with path.open('r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def render_seed(seed_dir: Path, out_dir: Path, defaults_path: Path) -> None:
    env = Environment(
        undefined=StrictUndefined,
        autoescape=False,
        block_start_string='[[%',
        block_end_string='%]]',
        comment_start_string='[[#',
        comment_end_string='#]]',
    )
    defaults = load_defaults(defaults_path)

    for root, dirs, files in os.walk(seed_dir):
        rel_root = Path(root).relative_to(seed_dir)
        out_root = out_dir / rel_root if rel_root != Path('.') else out_dir
        out_root.mkdir(parents=True, exist_ok=True)

        for name in files:
            src_path = Path(root) / name
            # Render text files; copy binary as-is
            if is_binary(src_path):
                dest_name = name[:-3] if name.endswith('.j2') else name
                shutil.copy2(src_path, out_root / dest_name)
                continue

            dest_name = name[:-3] if name.endswith('.j2') else name
            dest_path = out_root / dest_name

            with src_path.open('r', encoding='utf-8') as f:
                content = f.read()

            try:
                template = env.from_string(content)
                rendered = template.render(**defaults)
            except Exception as exc:
                raise RuntimeError(f"Failed rendering {src_path}: {exc}") from exc

            with dest_path.open('w', encoding='utf-8') as f:
                f.write(rendered)

            # Preserve permissions (e.g., make.sh)
            shutil.copymode(src_path, dest_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', required=True, help='Seed source directory')
    parser.add_argument('--out', required=True, help='Output directory')
    parser.add_argument('--defaults', required=True, help='Defaults JSON')
    args = parser.parse_args()

    seed_dir = Path(args.seed).resolve()
    out_dir = Path(args.out).resolve()
    defaults_path = Path(args.defaults).resolve()

    if not seed_dir.is_dir():
        raise SystemExit(f"Seed dir not found: {seed_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)

    render_seed(seed_dir, out_dir, defaults_path)


if __name__ == '__main__':
    main()
