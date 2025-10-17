"""
Minimal smoke test aligning with your Python prototype.
WHY: CI should fail early if imports or extraction break.
"""
import os
from enigma_painting_prototype import (
    GeneratorConfig, rng, generate_seed_points, generate_cells,
    stylize_cell, assign_numbers_and_regions, export_svg, export_json,
)
from enigma_painting_key_mask import extract_key_contour

SEED=7; COMPLEXITY=10
IMG_PATH=os.environ.get("ENIGMA_KEY_IMG", "Key.png")
THRESHOLD=130

cfg = GeneratorConfig(seed=SEED, complexity=COMPLEXITY)
r = rng(cfg.seed)
pts = generate_seed_points(cfg, r)
cells = generate_cells(cfg, pts)
shape = extract_key_contour(IMG_PATH, THRESHOLD)
assert shape is not None
polys = []
for cell in cells:
    typ, g = stylize_cell(cfg, r, cell)
    if getattr(g, "is_empty", True): continue
    polys.append(g)
numbers, regions = assign_numbers_and_regions(cfg, polys)
print("Smoke OK:", len(polys), "cells,", len(numbers), "numbers,", len(regions), "regions")
# no export to keep CI fast
