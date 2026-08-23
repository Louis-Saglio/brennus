#!/usr/bin/env python3
"""Paired A/B comparison of two run batches (two outdirs from tools/run.sh).

Usage: compare.py <base_dir> <aligned_dir> <seed>...
Compares city-phase and pop300 times per seed (paired), plus zero-JS-error
checks, and a paired t-test on the deltas (pure-python Student t CDF).
"""
import glob
import math
import os
import re
import sys

BASE, ALIGNED = sys.argv[1], sys.argv[2]
SEEDS = sys.argv[3:]

MILESTONE = re.compile(r"\[HARNESS\] t=([0-9.]+)m (phase=\w+.*|population=300)")


def run_data(d, tag):
    path = os.path.join(d, tag, "stdout.log")
    if not os.path.exists(path):
        return None
    out = open(path, errors="replace").read()
    errors = 0
    for log in glob.glob(os.path.join(d, tag, "home/.local/state/0ad/log/interestinglog_*.html")):
        errors += len(re.findall(r"^ERROR", open(log, errors="replace").read(), re.M))
    city = pop300 = None
    for line in out.splitlines():
        m = MILESTONE.search(line)
        if m:
            t, what = float(m.group(1)), m.group(2)
            if "phase_city" in what:
                city = t
            elif what == "population=300":
                pop300 = t
    return {"errors": errors, "city": city, "pop300": pop300}


def betacf(a, b, x):
    """Continued fraction for the incomplete beta function (NR)."""
    MAXIT, EPS, FPMIN = 200, 3e-12, 1e-300
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < FPMIN:
        d = FPMIN
    d = 1.0 / d
    h = d
    for m in range(1, MAXIT + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < FPMIN:
            d = FPMIN
        c = 1.0 + aa / c
        if abs(c) < FPMIN:
            c = FPMIN
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < FPMIN:
            d = FPMIN
        c = 1.0 + aa / c
        if abs(c) < FPMIN:
            c = FPMIN
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < EPS:
            break
    return h


def ibeta(a, b, x):
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    bt = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
                  + a * math.log(x) + b * math.log1p(-x))
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * betacf(a, b, x) / a
    return 1.0 - bt * betacf(b, a, 1.0 - x) / b


def t_cdf(x, df):
    if x == 0:
        return 0.5
    z = df / (df + x * x)
    return 1.0 - 0.5 * ibeta(df / 2.0, 0.5, z)


def paired_stats(diffs):
    n = len(diffs)
    mean = sum(diffs) / n
    var = sum((d - mean) ** 2 for d in diffs) / (n - 1) if n > 1 else 0.0
    sd = math.sqrt(var)
    se = sd / math.sqrt(n)
    t = mean / se if se > 0 else 0.0
    p = 2.0 * (1.0 - t_cdf(abs(t), n - 1)) if n > 1 and se > 0 else 1.0
    return mean, sd, t, p, n


def fmt(v):
    return f"{v:.1f}" if v is not None else "never"


def report(metric):
    rows = []
    for seed in SEEDS:
        b = run_data(BASE, f"seed{seed}")
        a = run_data(ALIGNED, f"seed{seed}")
        if not b or not a:
            print(f"  seed {seed}: MISSING run ({'base' if not b else 'aligned'})")
            continue
        rows.append((seed, b[metric], a[metric], b["errors"], a["errors"]))
    print(f"  {'seed':>4} | {'baseline':>8} | {'aligned':>8} | {'delta':>6} | errors b/a")
    for seed, bv, av, be, ae in rows:
        d = (av - bv) if (bv is not None and av is not None) else None
        print(f"  {seed:>4} | {fmt(bv):>8} | {fmt(av):>8} | "
              f"{fmt(d):>6} | {be}/{ae}")
    paired = [r[1] - r[2] for r in rows if r[1] is not None and r[2] is not None]
    bs = [r[1] for r in rows if r[1] is not None]
    as_ = [r[2] for r in rows if r[2] is not None]
    if bs:
        print(f"  mean baseline {sum(bs)/len(bs):.2f} (n={len(bs)}), "
              f"aligned {sum(as_)/len(as_):.2f} (n={len(as_)})")
    if paired:
        mean, sd, t, p, n = paired_stats(paired)
        print(f"  paired delta mean={mean:+.2f} sd={sd:.2f} "
              f"t={t:+.2f} p={p:.3f} (n={n})")
    if len(rows) < len(SEEDS):
        print(f"  WARNING: {len(SEEDS)-len(rows)} seed(s) censored at 18m")


print(f"== city phase (aligned - baseline, minutes)")
report("city")
print(f"== pop300 (aligned - baseline, minutes)")
report("pop300")
