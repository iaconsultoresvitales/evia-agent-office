// Furniture rotation: which pieces turn, that every orientation they offer has a valid drawing and geometry, that the rest never get one,
// that turning never breaks collisions, and that the orientation survives the trip to the server and back (layout.json).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadOffice, ROOT } from "./lib/office-harness.mjs";

const J = (v) => JSON.parse(JSON.stringify(v));
const h = loadOffice();
const P = h.run("POLayout");
const themes = J(h.run("THEME_NAMES"));

// ---------- 1. the audit, pinned: exactly these pieces turn. Giving another type `dirs` must be a deliberate change (sprite + geometry + here). ----------
const EXPECTED = { stool: ["right", "down", "left", "up"], meetingChair: ["down", "up"] };
const turnable = Object.keys(J(P.TYPES)).filter((t) => P.canRotate(t));
assert.deepEqual(turnable.sort(), Object.keys(EXPECTED).sort(), "only the stool and the meeting chair turn");
assert.deepEqual(J(P.rotatableTypes()).sort(), Object.keys(EXPECTED).sort(), "rotatableTypes() agrees");
for (const [type, dirs] of Object.entries(EXPECTED)) {
  assert.deepEqual(J(P.orientations(type)), dirs, `${type}: its orientations`);
  assert.ok(dirs.includes(P.DEFAULT_DIR[type]), `${type}: the default is one of them`);
}
for (const type of Object.keys(J(P.TYPES))) {
  if (EXPECTED[type]) continue;
  assert.equal(P.canRotate(type), false, `${type}: does not turn`);
  assert.deepEqual(J(P.orientations(type)), [], `${type}: no orientations`);
  assert.equal(P.DEFAULT_DIR[type], undefined, `${type}: no default direction`);
  assert.equal(J(P.TYPES[type]).dirs, undefined, `${type}: declares no dirs`);
}
for (const bad of ["nope", "__proto__", "constructor", "", undefined]) assert.equal(P.canRotate(bad), false, `canRotate(${String(bad)})`);

// ---------- 2. rotate(): a full cycle, both ways, nothing for the rest ----------
for (const [type, dirs] of Object.entries(EXPECTED)) {
  let it = { id: "x", type, tx: 5, ty: 12, dir: dirs[0] };
  const seen = [];
  for (let i = 0; i < dirs.length; i++) { seen.push(it.dir); it = P.rotate(it); }
  assert.deepEqual(seen, dirs, `${type}: one turn at a time through every orientation`);
  assert.equal(it.dir, dirs[0], `${type}: back to the start after a full circle`);
  assert.equal(P.rotate(P.rotate(it, 1), -1).dir, it.dir, `${type}: the other way undoes it`);
  const back = P.rotate({ ...it, dir: dirs[0] }, -1);
  assert.equal(back.dir, dirs[dirs.length - 1], `${type}: backwards from the first goes to the last`);
  assert.equal(P.rotate({ id: "x", type, tx: 5, ty: 12 }).dir, dirs[(dirs.indexOf(P.DEFAULT_DIR[type]) + 1) % dirs.length], `${type}: no dir = the default, then one step`);
  assert.equal(P.rotate({ id: "x", type, tx: 5, ty: 12, dir: "sideways" }).dir, dirs[(dirs.indexOf(P.DEFAULT_DIR[type]) + 1) % dirs.length], `${type}: a bad dir is treated as the default`);
  assert.equal(it.tx, 5, `${type}: turning does not move it`);
}
const sofa = { id: "s", type: "sofa", tx: 10, ty: 12 };
assert.strictEqual(P.rotate(sofa), sofa, "a piece that does not turn is returned untouched");
assert.equal(P.rotate({ id: "z", type: "__proto__", tx: 1, ty: 1 }).dir, undefined);

// ---------- 3. every orientation has geometry and a drawing ----------
const spotsOf = (items) => J(P.build(items).spots);
for (const [type, dirs] of Object.entries(EXPECTED)) {
  const base = P.defaultItems().find((i) => i.type === type);
  assert.ok(base, `${type}: is in the classic office`);
  const blocked = [...P.build(P.defaultItems()).blocked].sort();
  const sprite = new Map(), seatFacing = new Map();
  for (const dir of dirs) {
    const items = P.defaultItems().map((i) => (i.id === base.id ? { ...i, dir } : i));
    const full = P.scene(null, ["a", "b", "c"]).items.map((i) => (i.id === base.id ? { ...i, dir } : i));
    assert.equal(P.check(full, { empCount: 3 }).ok, true, `${type} ${dir}: passes the layout check`);
    assert.deepEqual(J(P.build(items).errors), [], `${type} ${dir}: builds without errors`);
    assert.deepEqual([...P.build(items).blocked].sort(), blocked, `${type} ${dir}: same blocked tiles (turning cannot open or close a path)`);
    assert.equal(P.sanitize(P.toDoc(full)).ok, true, `${type} ${dir}: the schema accepts it`);
    assert.equal(P.sanitize(P.toDoc(full)).items.find((i) => i.id === base.id).dir, dir, `${type} ${dir}: and keeps it`);
    const spot = spotsOf(items).find((s) => s.tx === base.tx && s.ty === base.ty && s.anim === "sitfree");
    assert.ok(spot, `${type} ${dir}: its seat is still a spot`);
    assert.equal(spot.dir, dir, `${type} ${dir}: whoever sits there faces that way`);
    seatFacing.set(dir, spot.dir);
    for (const th of themes) { // drawn in every look; the picture is the same size of work for each direction
      const decor = h.run(`buildStaticFor(${JSON.stringify(th)}, ${JSON.stringify(items)})`).decor;
      const mine = decor.filter((d) => d.id === base.id);
      assert.ok(mine.length >= 1, `${th} ${type} ${dir}: has a drawing`);
      const hash = mine.map((d) => h.hashDraw(d.draw)).join("|");
      assert.ok(hash, `${th} ${type} ${dir}: draws`);
      if (th === "default") sprite.set(dir, hash);
    }
  }
  assert.equal(new Set(seatFacing.values()).size, dirs.length, `${type}: every orientation seats the person differently`);
  const drawings = new Set(sprite.values()).size;
  if (type === "meetingChair") assert.equal(drawings, dirs.length, "meetingChair: each orientation has its own sprite (backrest on the other side)");
  else assert.equal(drawings, 1, "stool: round seat, one sprite for every orientation (the turn changes where the sitter looks)");
}

// ---------- 4. turning never breaks collisions or reachability ----------
{
  const ids = ["a", "b", "c"], items = P.scene(null, ids).items;
  for (const it of items.filter((i) => P.canRotate(i.type))) {
    let cur = it;
    for (let i = 0; i < P.orientations(it.type).length; i++) {
      cur = P.rotate(cur);
      const next = items.map((x) => (x.id === it.id ? cur : x));
      assert.equal(P.check(next, { empCount: 3 }).ok, true, `${it.id} turned to ${cur.dir}: still a valid layout`);
    }
  }
  // a piece that does not fit does not fit in any orientation (no direction is a way round a collision)
  for (const dir of EXPECTED.stool) {
    const onBin = [...items, { id: "s9", type: "stool", tx: 0, ty: 8, dir }]; // the bin stands on (0,8)
    assert.equal(P.check(onBin, { empCount: 3 }).ok, false, `stool ${dir} on the bin: refused`);
    const inWall = [...items, { id: "s9", type: "stool", tx: 10, ty: 1, dir }];
    assert.equal(P.check(inWall, { empCount: 3 }).ok, false, `stool ${dir} in the wall: refused`);
  }
  for (const dir of EXPECTED.meetingChair) assert.equal(P.check([...items, { id: "c9", type: "meetingChair", tx: 24, ty: 4, dir }], { empCount: 3 }).ok, false, `chair ${dir} on the meeting table: refused`);
  // findPlace keeps the direction of the piece it places
  const placed = P.findPlace(items, { id: "n1", type: "meetingChair", dir: "up" }, [14, 9], { empCount: 3 });
  assert.equal(placed.dir, "up", "findPlace keeps the chosen orientation");
}

// ---------- 5. the schema: no orientation a type does not have ----------
{
  const ok = (item) => P.sanitize({ v: 1, items: [item] });
  assert.equal(ok({ id: "c", type: "meetingChair", tx: 24, ty: 3, dir: "left" }).ok, false, "a meeting chair cannot face sideways");
  assert.equal(ok({ id: "c", type: "meetingChair", tx: 24, ty: 3, dir: "right" }).ok, false);
  assert.equal(ok({ id: "s", type: "stool", tx: 1, ty: 6, dir: "diagonal" }).ok, false, "no made-up directions");
  assert.equal(ok({ id: "s", type: "stool", tx: 1, ty: 6, dir: 3 }).ok, false);
  assert.equal(ok({ id: "s", type: "stool", tx: 1, ty: 6 }).items[0].dir, "right", "a stool without a direction gets the default");
  for (const type of Object.keys(J(P.TYPES)).filter((t) => !P.canRotate(t) && !J(P.TYPES)[t].wall)) {
    const r = ok({ id: "p", type, tx: 3, ty: 12, dir: "left" });
    assert.equal(r.ok, true, `${type}: a stray dir does not break the load`);
    assert.equal("dir" in r.items[0], false, `${type}: and is dropped, never stored`);
  }
}

// ---------- 6. the server: saved with its orientation, refused with a bad one ----------
const distLayout = path.join(ROOT, "dist/server/layout.js");
if (fs.existsSync(distLayout)) {
  const { OfficeLayout } = await import(pathToFileURL(distLayout).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "po-rotation-"));
  const ids = ["a", "b", "c"];
  const store = new OfficeLayout(dir);
  const turned = P.scene(null, ids).items.map((i) => (i.id === "stoolL" ? { ...i, dir: "up" } : i.id === "meetA" ? { ...i, dir: "up" } : i));
  const res = store.check(J(P.toDoc(turned)), ids);
  assert.equal(res.ok, true, `a turned layout is accepted: ${res.error}`);
  store.set(res.doc);
  const again = new OfficeLayout(dir).doc;
  assert.equal(again.items.find((i) => i.id === "stoolL").dir, "up", "the stool's orientation was saved and read back");
  assert.equal(again.items.find((i) => i.id === "meetA").dir, "up", "and the chair's");
  assert.equal(again.items.find((i) => i.id === "fridge").dir, undefined, "a piece that does not turn has none");
  const badChair = P.scene(null, ids).items.map((i) => (i.id === "meetA" ? { ...i, dir: "left" } : i));
  assert.equal(store.check(J(P.toDoc(badChair)), ids).ok, false, "the server refuses an orientation without a sprite");
  const fridgeDir = P.scene(null, ids).items.map((i) => (i.id === "fridge" ? { ...i, dir: "left" } : i));
  const cleaned = store.check(J(P.toDoc(fridgeDir)), ids);
  assert.equal(cleaned.ok && cleaned.doc.items.find((i) => i.id === "fridge").dir, undefined, "and strips one a fridge was sent");
  assert.equal(new OfficeLayout(dir).doc.items.find((i) => i.id === "stoolL").dir, "up", "refused layouts leave the saved one alone");
  console.log("rotation server side ok");
} else console.log("(dist not built: skipping the server-side rotation checks)");

console.log(`furniture rotation ok: ${turnable.join(" + ")} turn (${turnable.map((t) => EXPECTED[t].length).join(" / ")} orientations), ${themes.length} looks, nothing else gets a direction`);
