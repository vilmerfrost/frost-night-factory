import fs from "fs/promises";

export async function canSpend(kind, count=1){
  const cfg = JSON.parse(await fs.readFile("config/router.json","utf8"));
  const meterFile = "reports/budget_meter.json";
  let meter = { total:0, by:{} };
  try { meter = JSON.parse(await fs.readFile(meterFile,"utf8")); } catch {}
  const price = cfg.prices[kind+"_SEK"] || 0;
  const add = price * count;
  if ((meter.total + add) > cfg.night_total_SEK_max) return { ok:false, meter };
  meter.total += add; meter.by[kind] = (meter.by[kind]||0) + add;
  await fs.mkdir("reports",{recursive:true});
  await fs.writeFile(meterFile, JSON.stringify(meter,null,2));
  return { ok:true, meter };
}
