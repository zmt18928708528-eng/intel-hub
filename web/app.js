const stamp = document.querySelector("#stamp");
const warnings = document.querySelector("#warnings");

function money(q) {
  if (q.price == null) return "暂无报价";
  const n = Number(q.price).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${q.currency} ${n}${q.unit ? " / " + q.unit : ""}`;
}

function renderList(id, items) {
  const root = document.getElementById(id);
  root.innerHTML = items
    .map(
      (q) => `
      <article class="card ${id}">
        <div class="k">${q.vendor} · ${q.source}</div>
        <div>${q.title}</div>
        <div class="p">${money(q)}</div>
        <div class="k">${q.changePct != null ? q.changePct.toFixed(2) + "%" : ""}${q.inStock === false ? " · 缺货" : q.inStock ? " · 有货" : ""}</div>
        ${q.url ? `<a href="${q.url}" target="_blank" rel="noreferrer">来源</a>` : ""}
        ${q.note ? `<div class="k">${q.note}</div>` : ""}
      </article>`,
    )
    .join("");
}

async function load(only = "") {
  stamp.textContent = "加载中…";
  const qs = only ? `?only=${encodeURIComponent(only)}` : "";
  const res = await fetch(`/api/intel${qs}`);
  const data = await res.json();
  if (data.error) {
    stamp.textContent = data.error;
    return;
  }
  renderList("gold", data.gold ?? []);
  renderList("gpu", data.gpu ?? []);
  renderList("macmini", data.macmini ?? []);
  warnings.innerHTML = (data.warnings ?? []).map((w) => `<li>${w}</li>`).join("") || "<li>无</li>";
  stamp.textContent = data.asOf;
}

document.querySelectorAll("button[data-only]").forEach((btn) => {
  btn.addEventListener("click", () => load(btn.dataset.only));
});

load();
