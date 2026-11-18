/**
 * Self-contained browser demo. Bundled by scripts/build-standalone-demo.mjs
 * into a single HTML file that runs the real verifier with no install, server
 * or relay. All fixtures are deterministic and unspendable.
 */
import { runLab, runLifecycleTimeline, type LabReport, type LabScenario, type LifecycleTimeline } from "../apps/web/lib/lab";

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element as T;
};

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

let report: LabReport | null = null;
let selected = "rotation";
let advanced = false;

function verdictClass(verdict: string): string {
  if (verdict === "accepted") return "ok";
  if (verdict === "stale") return "warn";
  if (verdict === "revoked") return "muted";
  return "bad";
}

function renderLifecycle(timeline: LifecycleTimeline): void {
  $("lifecycle").innerHTML = timeline.nodes
    .map(
      (node, index) => `
      <div class="life-node ${node.status === "ACTIVE" ? "live" : node.status === "REVOKED" ? "dead" : ""}">
        <div class="micro">0${index + 1} · ${node.type}</div>
        <div class="node-status">${esc(node.status)}</div>
        <div class="mono address">${esc(node.address ?? "no address asserted")}</div>
        <div class="micro dim">sequence #${node.sequence}${node.status === "SUPERSEDED" ? " · historical" : ""}</div>
      </div>`,
    )
    .join('<div class="connector" aria-hidden="true"></div>');
}

function renderList(): void {
  if (!report) return;
  $("scenarios").innerHTML = report.scenarios
    .map(
      (scenario, index) => `
      <button class="scenario ${scenario.id === selected ? "active" : ""}" data-id="${esc(scenario.id)}">
        <div class="scenario-top"><span class="micro">0${index + 1}</span><span class="verdict ${verdictClass(scenario.verdict)}">${esc(scenario.verdict)}</span></div>
        <div class="scenario-title">${esc(scenario.title)}</div>
        <div class="scenario-q">${esc(scenario.question)}</div>
      </button>`,
    )
    .join("");
  document.querySelectorAll<HTMLButtonElement>(".scenario").forEach((button) => {
    button.addEventListener("click", () => {
      selected = button.dataset.id ?? "rotation";
      renderList();
      renderDetail();
    });
  });
}

function renderDetail(): void {
  const scenario = report?.scenarios.find((entry) => entry.id === selected);
  if (!scenario) return;
  $("detail").innerHTML = `
    <div class="detail-head">
      <div class="micro">scenario · ${esc(scenario.id)}</div>
      <span class="verdict ${verdictClass(scenario.verdict)}">${esc(scenario.verdict)} · ${esc(scenario.status)}</span>
    </div>
    <h2>${esc(scenario.title)}</h2>
    <p class="question">${esc(scenario.question)}</p>
    <div class="headline">${esc(scenario.headline)}</div>
    <h3>Explanation</h3>
    <p class="body">${esc(scenario.explanation)}</p>
    <h3>Verification evidence</h3>
    <ul class="checks">
      ${scenario.checks
        .map(
          (check) => `<li><span class="tick ${check.ok ? "yes" : "no"}">${check.ok ? "✓" : "×"}</span><div><div>${esc(check.label)}</div><div class="micro dim">${esc(check.detail)}</div></div></li>`,
        )
        .join("")}
    </ul>
    <div class="foot"><span class="micro dim">${scenario.events.length} signed events</span><span class="micro dim">${esc(scenario.testRef)}</span></div>
    ${
      advanced
        ? `<h3>Verifier result</h3><pre>${esc(JSON.stringify(scenario.resolution ?? scenario.recordResult, null, 2))}</pre>
           <h3>Signed input events</h3><pre>${esc(JSON.stringify(scenario.events, null, 2))}</pre>`
        : ""
    }
  `;
}

async function run(): Promise<void> {
  $("status").textContent = "Signing deterministic fixtures and verifying…";
  $("run").setAttribute("disabled", "true");
  try {
    const [lab, lifecycle] = await Promise.all([runLab(), runLifecycleTimeline()]);
    report = lab;
    renderLifecycle(lifecycle);
    renderList();
    renderDetail();
    $("status").textContent = `${lab.scenarios.length} scenarios · ${lab.fixtures.npub.slice(0, 16)}… · verified locally`;
  } catch (error) {
    $("status").textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    $("run").removeAttribute("disabled");
  }
}

$("run").addEventListener("click", () => void run());
$("advanced").addEventListener("click", () => {
  advanced = !advanced;
  $("advanced").textContent = advanced ? "Simple mode" : "Advanced mode";
  renderDetail();
});

void run();
