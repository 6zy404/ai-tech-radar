import sys, glob, re, os
# Needs fontTools: pip install fonttools
from fontTools import subset
chars = set()
# GB2312 level 1: rows 0xB0-0xD7
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode("gb2312"))
        except UnicodeDecodeError: pass
lvl1 = len(chars)
repo = sys.argv[1]
files = glob.glob(repo + "/config/technology-workspace.json") + glob.glob(repo + "/src/data/*.ts") + glob.glob(repo + "/src/lib/technology-localization.ts") + glob.glob(repo + "/src/lib/share-card.ts")
extra = set()
for f in files:
    for ch in open(f, encoding="utf-8").read():
        if ord(ch) >= 0x2E80: extra.add(ch)
added = extra - chars
chars |= extra
chars |= {chr(c) for c in range(0x20, 0x7F)}
chars |= set("，。、；：？！“”‘’（）《》【】—…·「」『』〈〉％＋－／～ ")
print("gb2312 level1", lvl1, "extra from content", len(added), "total", len(chars))
opts = subset.Options(); opts.layout_features = ["kern", "palt"]; opts.name_IDs = ["*"]; opts.notdef_outline = True; opts.hinting = False
font = subset.load_font(sys.argv[2], opts)
s = subset.Subsetter(opts); s.populate(text="".join(sorted(chars))); s.subset(font)
subset.save_font(font, sys.argv[3], opts)
print(os.path.getsize(sys.argv[3]))
