'use strict';

/**
 * Simple test runner — no external deps, runs with plain Node.js
 * Usage: node test/runTests.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Test harness ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅  ${message}`);
    passed++;
  } else {
    console.error(`  ❌  ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅  ${message}`);
    passed++;
  } else {
    console.error(`  ❌  ${message}`);
    console.error(`       Expected: ${JSON.stringify(expected)}`);
    console.error(`       Got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

function describe(suite, fn) {
  console.log(`\n📦 ${suite}`);
  fn();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeTempModel(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kendo-test-'));
  const file = path.join(dir, 'TestModel.cs');
  fs.writeFileSync(file, content, 'utf8');
  return { dir, file };
}

// ─── Load modules ─────────────────────────────────────────────────────────────
const { parseModelFile, scanModels, toLabel, resolveEditor } = require('../src/modelParser');
const { generateKendoForm, generateKendoGrid, generateKendoLogin, generateKendoRegister } = require('../src/generators');

// ═════════════════════════════════════════════════════════════════════════════
// TEST: toLabel
// ═════════════════════════════════════════════════════════════════════════════
describe('toLabel — camelCase to human label', () => {
  assertEqual(toLabel('CreatedDate'),   'Created Date',   'CreatedDate → "Created Date"');
  assertEqual(toLabel('firstName'),     'First Name',     'firstName  → "First Name"');
  assertEqual(toLabel('EmailAddress'),  'Email Address',  'EmailAddress → "Email Address"');
  assertEqual(toLabel('Id'),            'Id',             'Id → "Id"');
  assertEqual(toLabel('PhoneNumber'),   'Phone Number',   'PhoneNumber → "Phone Number"');
  assertEqual(toLabel('IsActive'),      'Is Active',      'IsActive → "Is Active"');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: resolveEditor
// ═════════════════════════════════════════════════════════════════════════════
describe('resolveEditor — C# type → Kendo editor', () => {
  assertEqual(resolveEditor('string').editor,    'TextBox',          'string → TextBox');
  assertEqual(resolveEditor('int').editor,       'NumericTextBox',   'int → NumericTextBox');
  assertEqual(resolveEditor('int?').editor,      'NumericTextBox',   'int? → NumericTextBox');
  assertEqual(resolveEditor('double').editor,    'NumericTextBox',   'double → NumericTextBox');
  assertEqual(resolveEditor('decimal').editor,   'NumericTextBox',   'decimal → NumericTextBox');
  assertEqual(resolveEditor('DateTime').editor,  'DatePicker',       'DateTime → DatePicker');
  assertEqual(resolveEditor('DateTime?').editor, 'DatePicker',       'DateTime? → DatePicker');
  assertEqual(resolveEditor('bool').editor,      'Switch',           'bool → Switch');
  assertEqual(resolveEditor('Guid').editor,      'TextBox',          'Guid → TextBox');

  assert(resolveEditor('int?').nullable === true,   'int? is nullable');
  assert(resolveEditor('string').nullable === false, 'string is not marked nullable by default');
  assert(resolveEditor('decimal').decimals === 2,    'decimal has 2 decimals');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: parseModelFile — simple model
// ═════════════════════════════════════════════════════════════════════════════
describe('parseModelFile — simple Customer model', () => {
  const csContent = `
using System;
using System.ComponentModel.DataAnnotations;

namespace MyApp.Models
{
    public class Customer
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; }

        public int Age { get; set; }

        public DateTime CreatedDate { get; set; }

        public bool IsActive { get; set; }

        public decimal Balance { get; set; }
    }
}`;

  const { file } = writeTempModel(csContent);
  const model = parseModelFile(file);

  assert(model !== null, 'Model parsed successfully');
  assertEqual(model.className, 'Customer', 'Class name is Customer');
  assert(model.fields.length >= 7, `Has at least 7 fields (got ${model.fields.length})`);

  const idField = model.fields.find(f => f.name === 'Id');
  assert(idField !== undefined,    'Id field exists');
  assert(idField.isId === true,    'Id field marked as isId');

  const nameField = model.fields.find(f => f.name === 'Name');
  assert(nameField !== undefined,            'Name field exists');
  assertEqual(nameField.editor,  'TextBox',  'Name uses TextBox');
  assert(nameField.required === true,        'Name is required');
  assert(nameField.maxLength === 100,        'Name has maxLength 100');

  const emailField = model.fields.find(f => f.name === 'Email');
  assert(emailField !== undefined,           'Email field exists');
  assert(emailField.email === true,          'Email has email attribute');
  assertEqual(emailField.inputType, 'email', 'Email input type is email');

  const ageField = model.fields.find(f => f.name === 'Age');
  assert(ageField !== undefined,                    'Age field exists');
  assertEqual(ageField.editor, 'NumericTextBox',    'Age uses NumericTextBox');

  const dateField = model.fields.find(f => f.name === 'CreatedDate');
  assert(dateField !== undefined,                   'CreatedDate field exists');
  assertEqual(dateField.editor, 'DatePicker',       'CreatedDate uses DatePicker');
  assertEqual(dateField.label, 'Created Date',      'CreatedDate label is "Created Date"');

  const boolField = model.fields.find(f => f.name === 'IsActive');
  assert(boolField !== undefined,                   'IsActive field exists');
  assertEqual(boolField.editor, 'Switch',           'IsActive uses Switch');

  const balanceField = model.fields.find(f => f.name === 'Balance');
  assert(balanceField !== undefined,                'Balance field exists');
  assertEqual(balanceField.editor, 'NumericTextBox','Balance uses NumericTextBox');
  assert(balanceField.decimals === 2,               'Balance has 2 decimals');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: parseModelFile — nullable & complex types
// ═════════════════════════════════════════════════════════════════════════════
describe('parseModelFile — nullable and complex types', () => {
  const csContent = `
public class Order
{
    public int Id { get; set; }
    public string OrderNumber { get; set; }
    public DateTime? ShippedDate { get; set; }
    public int? CustomerId { get; set; }
    public double Weight { get; set; }
    public bool IsPaid { get; set; }
    public virtual Customer Customer { get; set; }
}`;

  const { file } = writeTempModel(csContent);
  const model = parseModelFile(file);

  assert(model !== null, 'Order model parsed');
  assertEqual(model.className, 'Order', 'Class name is Order');

  const shipped = model.fields.find(f => f.name === 'ShippedDate');
  assert(shipped !== undefined,                  'ShippedDate exists');
  assertEqual(shipped.editor, 'DatePicker',      'ShippedDate uses DatePicker');
  assert(shipped.nullable === true,              'ShippedDate is nullable');

  const custId = model.fields.find(f => f.name === 'CustomerId');
  assert(custId !== undefined,                   'CustomerId exists');
  assert(custId.nullable === true,               'CustomerId? is nullable');

  const navProp = model.fields.find(f => f.name === 'Customer');
  assert(navProp === undefined || navProp.isVirtual === true, 'Virtual Customer nav property skipped or marked virtual');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: scanModels — directory scan
// ═════════════════════════════════════════════════════════════════════════════
describe('scanModels — multi-file directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kendo-scan-'));
  const modelsDir = path.join(tmpDir, 'Models');
  fs.mkdirSync(modelsDir);

  fs.writeFileSync(path.join(modelsDir, 'Customer.cs'), `
public class Customer { public int Id { get; set; } public string Name { get; set; } }`, 'utf8');

  fs.writeFileSync(path.join(modelsDir, 'Product.cs'), `
public class Product { public int Id { get; set; } public string Title { get; set; } public decimal Price { get; set; } }`, 'utf8');

  fs.writeFileSync(path.join(modelsDir, 'NotAModel.cs'), `
namespace MyApp { public static class Helper { public static void DoThing() {} } }`, 'utf8');

  const models = scanModels(tmpDir, 'Models');

  assert(models.length >= 2, `At least 2 models found (got ${models.length})`);
  assert(models.some(m => m.className === 'Customer'), 'Customer model found');
  assert(models.some(m => m.className === 'Product'),  'Product model found');
  assert(!models.some(m => m.className === 'Helper'),  'Helper class not included (no properties)');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: generateKendoForm
// ═════════════════════════════════════════════════════════════════════════════
describe('generateKendoForm — output validation', () => {
  const model = {
    className: 'Customer',
    fields: [
      { name: 'Id',    label: 'Id',    rawType: 'int',      kendoType: 'number', editor: 'NumericTextBox', isId: true,  isVirtual: false, hidden: false, required: true,  nullable: false, email: false, maxLength: null, range: null, decimals: null, format: null },
      { name: 'Name',  label: 'Name',  rawType: 'string',   kendoType: 'string', editor: 'TextBox',        isId: false, isVirtual: false, hidden: false, required: true,  nullable: true,  email: false, maxLength: 100,  range: null, decimals: null, format: null },
      { name: 'Email', label: 'Email', rawType: 'string',   kendoType: 'string', editor: 'TextBox',        isId: false, isVirtual: false, hidden: false, required: true,  nullable: true,  email: true,  maxLength: null, range: null, decimals: null, format: null },
      { name: 'Age',   label: 'Age',   rawType: 'int',      kendoType: 'number', editor: 'NumericTextBox', isId: false, isVirtual: false, hidden: false, required: false, nullable: false, email: false, maxLength: null, range: null, decimals: null, format: null },
      { name: 'CreatedDate', label: 'Created Date', rawType: 'DateTime', kendoType: 'date', editor: 'DatePicker', isId: false, isVirtual: false, hidden: false, required: false, nullable: false, email: false, maxLength: null, range: null, decimals: null, format: null },
    ],
  };

  const code = generateKendoForm(model, { controllerName: 'Customers' });

  assert(code.includes('@model Customer'),            'Has @model directive');
  assert(code.includes('kendoForm'),                  'Has kendoForm initialization');
  assert(code.includes('"Name"'),                     'Has Name field');
  assert(code.includes('"Email"'),                    'Has Email field');
  assert(code.includes('"Age"'),                      'Has Age field');
  assert(code.includes('"CreatedDate"'),              'Has CreatedDate field');
  assert(code.includes('NumericTextBox'),             'Age uses NumericTextBox');
  assert(code.includes('DatePicker'),                 'CreatedDate uses DatePicker');
  assert(code.includes('@section Scripts'),           'Has @section Scripts');
  assert(code.includes('$(document).ready'),         'Has document ready');
  assert(code.includes('Customers'),                  'Controller name in URL');
  assert(!code.includes('"Id"'),                      'Id field excluded from form');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: generateKendoGrid
// ═════════════════════════════════════════════════════════════════════════════
describe('generateKendoGrid — output validation', () => {
  const model = {
    className: 'Product',
    fields: [
      { name: 'Id',    label: 'ID',    rawType: 'int',     kendoType: 'number', editor: 'NumericTextBox', isId: true,  isVirtual: false, hidden: false, required: true,  nullable: false, decimals: null, format: null },
      { name: 'Title', label: 'Title', rawType: 'string',  kendoType: 'string', editor: 'TextBox',        isId: false, isVirtual: false, hidden: false, required: true,  nullable: true,  decimals: null, format: null },
      { name: 'Price', label: 'Price', rawType: 'decimal', kendoType: 'number', editor: 'NumericTextBox', isId: false, isVirtual: false, hidden: false, required: false, nullable: false, decimals: 2,    format: 'c2' },
    ],
  };

  const code = generateKendoGrid(model, { controllerName: 'Products' });

  assert(code.includes('kendoGrid'),            'Has kendoGrid');
  assert(code.includes('"Title"'),              'Has Title column');
  assert(code.includes('"Price"'),              'Has Price column');
  assert(code.includes('serverPaging: true'),   'Has server paging');
  assert(code.includes('serverSorting: true'),  'Has server sorting');
  assert(code.includes('serverFiltering: true'),'Has server filtering');
  assert(code.includes('Products'),             'Has Products controller URLs');
  assert(code.includes('Read'),                 'Has Read endpoint');
  assert(code.includes('Create'),               'Has Create endpoint');
  assert(code.includes('Update'),               'Has Update endpoint');
  assert(code.includes('Delete'),               'Has Delete endpoint');
  assert(code.includes('excel'),                'Has Excel export');
  assert(code.includes('pdf'),                  'Has PDF export');
  assert(code.includes('@section Scripts'),     'Has @section Scripts');
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST: generateKendoLogin / Register
// ═════════════════════════════════════════════════════════════════════════════
describe('generateKendoLogin / Register — structure check', () => {
  const login = generateKendoLogin();
  assert(login.includes('<form id="loginForm"'),   'Login has form element');
  assert(login.includes('type="email"'),           'Login has email input');
  assert(login.includes('type="password"'),        'Login has password input');
  assert(login.includes('kendoValidator'),         'Login uses kendoValidator');
  assert(login.includes('$.ajax'),                 'Login uses AJAX');
  assert(login.includes('Account'),                'Login targets Account controller');

  const register = generateKendoRegister();
  assert(register.includes('<form id="registerForm"'), 'Register has form element');
  assert(register.includes('ConfirmPassword'),         'Register has ConfirmPassword');
  assert(register.includes('ProfilePicture'),          'Register has file upload');
  assert(register.includes('kendoDatePicker'),         'Register uses DatePicker for DOB');
  assert(register.includes('kendoDropDownList'),       'Register uses DropDownList for Gender');
  assert(register.includes('password-strength'),       'Register has password strength meter');
  assert(register.includes('$.ajax'),                  'Register uses AJAX');
  assert(register.includes('AntiForgeryToken'),        'Register includes AntiForgeryToken');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed > 0) {
  console.error('\n⚠️  Some tests failed.');
  process.exit(1);
} else {
  console.log('\n🎉  All tests passed!');
  process.exit(0);
}
