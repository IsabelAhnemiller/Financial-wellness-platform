const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
let budgetChart = null;

let debtChart = null;

function renderChart(income, expenses) {
  const canvas = document.getElementById("budgetChart");

  if (!canvas) return;

  if (budgetChart) {
    budgetChart.destroy();
  }
  budgetChart = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: [
        "Income",
        "Expenses"
      ],

      datasets: [{
        data: [
          income,
          expenses
        ],

      backgroundColor: [
        "#22c55e",
        "#ef4444"
      ]
    }]
    },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom"
      }
    }
  }
  });
}

function updateSavingsGoal (currentSavings, targetGoal) {
  const percent = targetGoal > 0
  ? Math.min((currentSavings / targetGoal) * 100, 100)
  : 0;
  $("#goalDisplay").textContent=`Goal: ${money.format(targetGoal)}`;
  $("#savings").textContent = money.format(currentSavings);
  $("#savingsFill").style.width = `${percent}%`;
  $("#savingsPercent").textContent = `${Math.round(percent)}% Complete`;
}

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

let savingsGoal = Number(localStorage.getItem("savingsGoal")) || 5000;

const saveGoalButton =
    document.getElementById("saveGoalButton");

if (saveGoalButton) {

    saveGoalButton.addEventListener("click", () => {

        const value =
            Number($("#goalAmount").value);

        if (value > 0) {

            savingsGoal = value;

            localStorage.setItem(
                "savingsGoal",
                value
            );

            loadSummary();
        }
    });
}


async function loadSummary() {
  const data = await api("/api/dashboard/summary");
  $("#totalIncome").textContent = money.format(data.totalIncome); $("#totalExpenses").textContent = money.format(data.totalExpenses);
  $("#remaining").textContent = money.format(data.remaining); $("#totalDebt").textContent = money.format(data.totalDebt);



  renderDebtProjection(
    data.totalDebt,
    data.remaining
  );

  let score = 0;

  if (data.totalIncome > 0) {
    score =
        ((data.totalIncome - data.totalExpenses)
        / data.totalIncome) * 100;
  }

  const currentSavings = data.remaining;
  updateSavingsGoal(currentSavings, savingsGoal)
  
  const percent = data.totalIncome > 0 ? Math.max(0, Math.min(100, ((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100)) : 0;
  $("#remainingPercent").textContent = `${Math.round(percent)}%`; $("#progressBar").style.width = `${percent}%`;
  $("#spentLabel").textContent = `${money.format(data.totalExpenses)} spent`; $("#incomeLabel").textContent = `${money.format(data.totalIncome)} income`;
  $("#activityList").innerHTML = data.activity.length ? data.activity.map((item) => `<div class="activity"><div class="activity-icon ${item.kind}">${item.kind === "income" ? "↗" : "↘"}</div><div><strong>${escapeHtml(item.label)}</strong><span>${new Date(item.item_date).toLocaleDateString()}</span></div><b class="${item.kind}">${item.kind === "income" ? "+" : "-"}${money.format(item.amount)}</b></div>`).join("") : '<p class="empty">No activity yet. Add your first entry below.</p>';
  renderChart(
    data.totalIncome,
    data.totalExpenses
  );

  const monthlyGrowth = Math.max(data.remaining, 1);

  const monthsLeft =
    Math.ceil(
        (savingsGoal - currentSavings)
        / monthlyGrowth
    );

  score = Math.max(0, Math.min(100, score));

  $("#healthScore").textContent =
    `${Math.round(score)}/100`;

  if (score > 70)
    $("#healthScore").style.color = "#176b51";
  else if (score > 40)
    $("#healthScore").style.color = "#a85e16";
  else
    $("#healthScore").style.color = "#a83f3f";
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



function renderDebtProjection(totalDebt, remaining) {
    const canvas =
        document.getElementById("debtProjectionChart");

    if (!canvas) return;

    if(debtChart){
      debtChart.destroy();
    }

    let balance = totalDebt;
    const labels = [];
    const values = [];

    const payment =
        Math.max(remaining * 0.3, 50);

    let month = 0;

    while (balance > 0 && month < 60) {
        labels.push(`Month ${month}`);
        values.push(balance);

        balance -= payment;
        month++;
    }
  
    debtChart = new Chart(canvas, {
    type: "line",

    data: {
        labels,
        datasets: [{
            label: "Projected Debt",

            data: values,

            borderColor: "#7352a3",
            backgroundColor: "#7352a320",

            fill: true,

            tension: 0.3
        }]
    },
    options: {
        responsive: true,

        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
  });
}