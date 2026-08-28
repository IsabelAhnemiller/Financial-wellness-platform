const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: "lax", maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in." });
  next();
}

app.get("/api/health", async (_req, res) => {
  try { await db.query("SELECT 1"); res.json({ ok: true }); }
  catch { res.status(500).json({ ok: false, error: "MySQL is not connected." }); }
});

app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, username, password } = req.body;
  if (![firstName, lastName, email, username, password].every(Boolean)) return res.status(400).json({ error: "All fields are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      "INSERT INTO users (first_name,last_name,email,username,password_hash) VALUES (?,?,?,?,?)",
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), username.trim(), passwordHash]
    );
    await db.execute("INSERT INTO user_roles (user_id,role_id) SELECT ?,role_id FROM roles WHERE role_name='USER'", [result.insertId]);
    req.session.userId = result.insertId;
    res.status(201).json({ message: "Account created.", user: { userId: result.insertId, firstName } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That email or username is already registered." });
    console.error(error); res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  try {
    const [rows] = await db.execute("SELECT user_id,first_name,password_hash,account_status FROM users WHERE email=?", [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || user.account_status !== "ACTIVE" || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Invalid email or password." });
    req.session.userId = user.user_id;
    res.json({ message: "Login successful.", user: { userId: user.user_id, firstName: user.first_name } });
  } catch (error) { console.error(error); res.status(500).json({ error: "Login failed." }); }
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ message: "Signed out." })));

app.get("/api/me", requireLogin, async (req, res) => {
  const [rows] = await db.execute("SELECT user_id,first_name,last_name,email,username FROM users WHERE user_id=?", [req.session.userId]);
  res.json({ user: rows[0] });
});

app.get("/api/categories", requireLogin, async (_req, res) => {
  const [rows] = await db.query("SELECT category_id,category_name FROM expense_categories ORDER BY category_name");
  res.json(rows);
});

app.post("/api/income", requireLogin, async (req, res) => {
  const { source, amount, incomeType, incomeDate, description = "" } = req.body;
  if (!source || Number(amount) <= 0 || !incomeDate) return res.status(400).json({ error: "Source, positive amount, and date are required." });
  const [result] = await db.execute("INSERT INTO income (user_id,source,amount,income_type,income_date,description) VALUES (?,?,?,?,?,?)", [req.session.userId, source, Number(amount), incomeType || "Other", incomeDate, description]);
  res.status(201).json({ message: "Income added.", incomeId: result.insertId });
});

app.post("/api/expenses", requireLogin, async (req, res) => {
  const { categoryId, amount, expenseDate, merchant, description = "" } = req.body;
  if (!categoryId || Number(amount) <= 0 || !expenseDate) return res.status(400).json({ error: "Category, positive amount, and date are required." });
  const [result] = await db.execute("INSERT INTO expenses (user_id,category_id,amount,expense_date,merchant,description) VALUES (?,?,?,?,?,?)", [req.session.userId, Number(categoryId), Number(amount), expenseDate, merchant || "", description]);
  res.status(201).json({ message: "Expense added.", expenseId: result.insertId });
});

app.get("/api/dashboard/summary", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const [summary] = await db.execute(`SELECT
    (SELECT COALESCE(SUM(amount),0) FROM income WHERE user_id=? AND YEAR(income_date)=YEAR(CURDATE()) AND MONTH(income_date)=MONTH(CURDATE())) total_income,
    (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=? AND YEAR(expense_date)=YEAR(CURDATE()) AND MONTH(expense_date)=MONTH(CURDATE())) total_expenses,
    (SELECT COALESCE(SUM(current_balance),0) FROM debts WHERE user_id=?) total_debt`, [userId, userId, userId]);
  const [activity] = await db.execute(`
    (SELECT income_id id, source label, amount, income_date item_date, 'income' kind FROM income WHERE user_id=? ORDER BY income_date DESC LIMIT 4)
    UNION ALL
    (SELECT expense_id id, COALESCE(NULLIF(merchant,''),ec.category_name) label, e.amount, expense_date item_date, 'expense' kind FROM expenses e JOIN expense_categories ec ON ec.category_id=e.category_id WHERE e.user_id=? ORDER BY expense_date DESC LIMIT 4)
    ORDER BY item_date DESC LIMIT 6`, [userId, userId]);
  const item = summary[0];
  res.json({ totalIncome: item.total_income, totalExpenses: item.total_expenses, remaining: item.total_income - item.total_expenses, totalDebt: item.total_debt, activity });
});

app.post("/api/calculator/debt-payoff", requireLogin, (req, res) => {
  let balance = Number(req.body.balance); const rate = Number(req.body.interestRate); const payment = Number(req.body.monthlyPayment);
  const monthlyRate = rate / 100 / 12;
  if (balance <= 0 || rate < 0 || payment <= balance * monthlyRate) return res.status(400).json({ error: "The payment must be greater than the monthly interest." });
  let months = 0, totalInterest = 0;
  while (balance > 0 && months < 1200) { const interest = balance * monthlyRate; totalInterest += interest; balance = Math.max(0, balance + interest - payment); months += 1; }
  res.json({ monthsToPayoff: months, yearsToPayoff: Number((months / 12).toFixed(1)), totalInterest: Number(totalInterest.toFixed(2)) });
});

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }
  next();
});

const port = Number(process.env.PORT || 3000);
app.listen(port, async () => {
  console.log(`Financial Wellness running at http://localhost:${port}`);
  try { await db.query("SELECT 1"); console.log("Connected to XAMPP MySQL."); }
  catch (error) { console.error("MySQL connection failed. Start MySQL in XAMPP and check .env."); }
});
