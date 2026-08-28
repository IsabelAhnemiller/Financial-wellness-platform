CREATE DATABASE IF NOT EXISTS financial_wellness;
USE financial_wellness;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);
INSERT IGNORE INTO roles (role_name,description) VALUES ('USER','Standard user'),('ADMIN','Administrator');

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (user_id,role_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS income (
  income_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  income_type VARCHAR(50),
  income_date DATE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
);
INSERT IGNORE INTO expense_categories (category_name) VALUES
('Housing'),('Food'),('Transportation'),('Utilities'),('Entertainment'),
('Healthcare'),('Insurance'),('Education'),('Debt Payments'),('Other');

CREATE TABLE IF NOT EXISTS expenses (
  expense_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  merchant VARCHAR(100),
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
);

CREATE TABLE IF NOT EXISTS budgets (
  budget_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  budget_month TINYINT NOT NULL,
  budget_year SMALLINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_month (user_id,budget_month,budget_year),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_items (
  budget_item_id INT AUTO_INCREMENT PRIMARY KEY,
  budget_id INT NOT NULL,
  category_id INT NOT NULL,
  budget_amount DECIMAL(12,2) NOT NULL,
  UNIQUE KEY unique_budget_category (budget_id,category_id),
  FOREIGN KEY (budget_id) REFERENCES budgets(budget_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
);

CREATE TABLE IF NOT EXISTS debts (
  debt_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  debt_name VARCHAR(100) NOT NULL,
  debt_type VARCHAR(50),
  original_balance DECIMAL(12,2),
  current_balance DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  minimum_payment DECIMAL(12,2),
  payment_due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
