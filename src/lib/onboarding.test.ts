import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDay,
  parseTime,
  sampleDocument,
  scanOperations,
} from "./onboarding";
import { presets, simulate } from "./simulation";
import { POST } from "../app/api/scan/route";
function textPDF(text: string) {
  const stream = `BT /F1 12 Tf 40 740 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return content;
}
const ops = {
  inventory: 240,
  foodCost: 0.31,
  vendorCost: 85,
  otherCost: 75,
  staff: [
    { name: "Alex", role: "cook" as const, start: 11, end: 21, pay: 22 },
    { name: "Sam", role: "front" as const, start: 11, end: 21, pay: 18 },
  ],
};
const changes = {
  orders: 180,
  driveThrough: false,
  driveShare: 20,
  seats: 32,
  stations: 5,
};
test("complete operating document extracts real fields and staff shifts", () => {
  const scan = scanOperations(sampleDocument);
  assert.deepEqual(scan.missing, []);
  assert.equal(scan.found.inventory, 240);
  assert.equal(scan.found.foodCost, 0.31);
  assert.equal(scan.found.vendorCost, 85);
  assert.equal(scan.found.staff?.length, 4);
  assert.equal(scan.found.staff?.[3].start, 15);
  assert.equal(scan.found.vendorItems?.[0].supplier, "Maple Paper Co.");
  assert.equal(scan.found.vendorItems?.[1].unitPrice, 6.2);
  assert.equal(scan.found.fixedCosts?.length, 3);
});
test("partial and unrelated files leave missing fields for manual fallback", () => {
  const scan = scanOperations("Inventory: 100 portions\nFood cost: 32%");
  assert.equal(scan.found.inventory, 100);
  assert.equal(scan.missing.length, 3);
  assert.equal(scan.found.staff, undefined);
  assert.equal(
    scanOperations("a grocery receipt with no setup fields").missing.length,
    5,
  );
});
test("scanner rejects invented/invalid structured fields and accepts actual zero cost", () => {
  assert.equal(
    scanOperations(
      JSON.stringify({ inventory: -1, foodCost: 500, staff: [{ name: "X" }] }),
    ).missing.length,
    5,
  );
  const scan = scanOperations(
    "Vendor costs per day: $0\nOther costs per day: $0",
  );
  assert.equal(scan.found.vendorCost, 0);
  assert.equal(scan.found.otherCost, 0);
  assert.equal(parseTime("11:60"), NaN);
  assert.equal(parseTime("abc"), NaN);
});
test("day selection changes demand; skip starts from the same fully simulated history", () => {
  const schedule = {
    day: "Friday" as const,
    opening: 11,
    closing: 21,
    start: 11,
  };
  const a = buildDay("small", ops, schedule, changes),
    b = buildDay("small", ops, { ...schedule, start: 17 }, changes);
  assert.deepEqual(simulate(a), simulate(b));
  assert.ok(
    simulate(a).orders.length >
      simulate(buildDay("small", ops, { ...schedule, day: "Monday" }, changes))
        .orders.length,
  );
  assert.ok(simulate(b).frames[360].completed > 0);
  assert.equal(a.overhead, 160);
  assert.equal(a.staff?.[0].start, 0);
});
test("invalid start times, missing details and non-overlapping staff cannot launch", () => {
  const day = { day: "Friday" as const, opening: 11, closing: 21, start: 22 };
  assert.throws(() => buildDay("small", ops, day, changes));
  assert.throws(() =>
    buildDay("small", { ...ops, staff: [] }, { ...day, start: 11 }, changes),
  );
  assert.throws(() =>
    buildDay(
      "small",
      { ...ops, staff: ops.staff.map((s) => ({ ...s, start: 7, end: 10 })) },
      { ...day, start: 11 },
      changes,
    ),
  );
});
test("inventory limits preparation and stockout losses incur no food cost", () => {
  const c = { ...presets.small.config, inventory: 5 },
    r = simulate(c);
  assert.ok(r.completed <= 5);
  assert.equal(r.orders.filter((o) => Number.isFinite(o.start)).length, 5);
  assert.ok(r.orders.some((o) => o.stockout));
  assert.ok(
    r.orders
      .filter((o) => o.stockout)
      .every((o) => o.food > 0 && o.fee === 0 && !Number.isFinite(o.start)),
  );
  assert.equal(simulate({ ...c, inventory: 0 }).food, 0);
});
test("individual shifts control capacity and hourly pay determines payroll", () => {
  const c = {
      ...presets.small.config,
      cooks: 1,
      servers: 1,
      staff: [
        { name: "Cook", role: "cook" as const, start: 2, end: 4, pay: 30 },
        { name: "Server", role: "front" as const, start: 0, end: 4, pay: 15 },
      ],
    },
    r = simulate(c);
  assert.equal(r.labor, 120);
  assert.ok(r.frames.slice(0, 120).every((f) => f.cooking === 0));
  assert.ok(
    r.orders
      .filter((o) => Number.isFinite(o.start))
      .every((o) => o.start >= 120 && o.ready <= 240),
  );
  assert.ok(r.completed > 0);
});
test("upload endpoint extracts text and returns actionable missing-field results", async () => {
  const form = new FormData();
  form.append(
    "file",
    new File(["Inventory: 120 portions"], "stock.txt", { type: "text/plain" }),
  );
  const response = await POST(
    new Request("http://localhost/api/scan", { method: "POST", body: form }),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.found.inventory, 120);
  assert.ok(data.missing.includes("Staff roster, shifts and pay"));
});
test("unsupported and unreadable uploads produce a manual-entry fallback", async () => {
  for (const [name, text] of [
    ["image.png", "xyz"],
    ["empty.txt", ""],
  ]) {
    const form = new FormData();
    form.append("file", new File([text], name));
    const r = await POST(
      new Request("http://localhost/api/scan", { method: "POST", body: form }),
    );
    assert.ok(r.status >= 400);
    assert.equal(typeof (await r.json()).error, "string");
  }
});
test("PDF upload reads actual document text rather than simulating extraction", async () => {
  const form = new FormData();
  form.append(
    "file",
    new File([textPDF("Inventory: 90 portions")], "inventory.pdf", {
      type: "application/pdf",
    }),
  );
  const r = await POST(
    new Request("http://localhost/api/scan", { method: "POST", body: form }),
  );
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  assert.equal(data.found.inventory, 90);
  assert.ok(data.missing.includes("Food cost percentage"));
});
