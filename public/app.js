const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function showToast(message, error = false) {
  const toast = $("#toast"); toast.textContent = message; toast.className = error ? "show error" : "show";
  setTimeout(() => { toast.className = ""; }, 3000);
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function setToday() { document.querySelectorAll('input[type="date"]').forEach((input) => { if (!input.value) input.valueAsDate = new Date(); }); }

async function checkHealth() {
  try { await api("/api/health"); $("#dbStatus").textContent = "MySQL connected"; $("#dbDot").classList.add("online"); }
  catch { $("#dbStatus").textContent = "MySQL not connected"; }
}

async function showDashboard(user) {
  $("#firstName").textContent = user.firstName || user.first_name || "User";
  $("#authView").classList.add("hidden"); $("#dashboardView").classList.remove("hidden");
  await Promise.all([loadCategories(), loadSummary()]); setToday();
}

async function loadCategories() {
  const categories = await api("/api/categories");
  $("#categorySelect").innerHTML = categories.map((c) => `<option value="${c.category_id}">${escapeHtml(c.category_name)}</option>`).join("");
}

async function loadSummary() {
  const data = await api("/api/dashboard/summary");
  $("#totalIncome").textContent = money.format(data.totalIncome); $("#totalExpenses").textContent = money.format(data.totalExpenses);
  $("#remaining").textContent = money.format(data.remaining); $("#totalDebt").textContent = money.format(data.totalDebt);
  const percent = data.totalIncome > 0 ? Math.max(0, Math.min(100, ((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100)) : 0;
  $("#remainingPercent").textContent = `${Math.round(percent)}%`; $("#progressBar").style.width = `${percent}%`;
  $("#spentLabel").textContent = `${money.format(data.totalExpenses)} spent`; $("#incomeLabel").textContent = `${money.format(data.totalIncome)} income`;
  $("#activityList").innerHTML = data.activity.length ? data.activity.map((item) => `<div class="activity"><div class="activity-icon ${item.kind}">${item.kind === "income" ? "↗" : "↘"}</div><div><strong>${escapeHtml(item.label)}</strong><span>${new Date(item.item_date).toLocaleDateString()}</span></div><b class="${item.kind}">${item.kind === "income" ? "+" : "-"}${money.format(item.amount)}</b></div>`).join("") : '<p class="empty">No activity yet. Add your first entry below.</p>';
}

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value); return node.innerHTML; }

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab,.form-panel").forEach((item) => item.classList.remove("active"));
  tab.classList.add("active"); $(`#${tab.dataset.tab}Form`).classList.add("active");
}));

$("#loginForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api("/api/login", { method: "POST", body: JSON.stringify(formData(event.target)) }); showToast(result.message); await showDashboard(result.user); } catch (e) { showToast(e.message, true); } });
$("#registerForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api("/api/register", { method: "POST", body: JSON.stringify(formData(event.target)) }); showToast(result.message); await showDashboard(result.user); } catch (e) { showToast(e.message, true); } });
$("#logoutButton").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); location.reload(); });
$("#incomeForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api("/api/income", { method: "POST", body: JSON.stringify(formData(event.target)) }); showToast(result.message); event.target.reset(); setToday(); await loadSummary(); } catch (e) { showToast(e.message, true); } });
$("#expenseForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api("/api/expenses", { method: "POST", body: JSON.stringify(formData(event.target)) }); showToast(result.message); event.target.reset(); setToday(); await loadSummary(); } catch (e) { showToast(e.message, true); } });
$("#calculatorForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api("/api/calculator/debt-payoff", { method: "POST", body: JSON.stringify(formData(event.target)) }); const box = $("#calculatorResult"); box.classList.remove("hidden"); box.innerHTML = `<span>Estimated payoff</span><strong>${result.monthsToPayoff} months</strong><small>${result.yearsToPayoff} years · ${money.format(result.totalInterest)} interest</small>`; } catch (e) { showToast(e.message, true); } });

$("#monthLabel").textContent = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
checkHealth(); setToday();
api("/api/me").then((result) => showDashboard(result.user)).catch(() => {});
