#!/usr/bin/env python3
"""Strip all JS comments from a JS file, preserving code exactly.

State machine: tracks string literals ("...", '...', `...`) so `//` and `/*`
inside strings are never treated as comments. Comment-only lines become at
most one blank separator line; runs of blank lines collapse to one.

Usage: strip_comments.py <in.js> <out.js>
"""
import sys

src = open(sys.argv[1]).read()
lines = []
cur = ""
pending_blank = False
n = len(src)
i = 0

def text(s):  # s contains no newlines
    global cur, pending_blank
    if s == "":
        pending_blank = True
        return
    if pending_blank:
        if cur.strip():
            lines.append(cur.rstrip())
        cur = ""
        lines.append("")
        pending_blank = False
    cur += s

def nl():
    global cur, pending_blank
    if pending_blank:
        if cur.strip():
            lines.append(cur.rstrip())
        cur = ""
        pending_blank = False
    lines.append(cur.rstrip())
    cur = ""

while i < n:
    c = src[i]
    if c == "\n":
        nl()
    elif c == "/" and i + 1 < n and src[i + 1] == "/":
        text("")
        while i < n and src[i] != "\n":
            i += 1
    elif c == "/" and i + 1 < n and src[i + 1] == "*":
        text("")
        i += 2
        while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
            i += 1
        i += 2
    elif c in "\"'`":
        j = i + 1
        while j < n:
            if src[j] == "\\":
                j += 2
                continue
            if src[j] == c:
                j += 1
                break
            j += 1
        for ch in src[i:j]:
            if ch == "\n":
                nl()
            else:
                text(ch)
        i = j
        continue
    else:
        j = i
        while j < n and src[j] != "\n":
            if src[j] == "/" and j + 1 < n and src[j + 1] in "/*":
                break
            if src[j] in "\"'`":
                break
            j += 1
        for ch in src[i:j]:
            text(ch)
        i = j
        continue
    i += 1

if cur.strip():
    lines.append(cur.rstrip())

# drop a leading blank from a file-start comment
while lines and lines[0] == "":
    lines.pop(0)
# drop trailing blank
while lines and lines[-1] == "":
    lines.pop()
# collapse blank runs to one
coll = []
prevblank = False
for l in lines:
    if l == "":
        if not prevblank:
            coll.append("")
        prevblank = True
    else:
        coll.append(l)
        prevblank = False

text_out = "\n".join(coll) + "\n"
open(sys.argv[2], "w").write(text_out)
