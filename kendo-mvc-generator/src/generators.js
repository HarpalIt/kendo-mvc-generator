'use strict';

const { getFormFields, getGridFields } = require('./modelParser');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function indent(str, spaces = 4) {
  const pad = ' '.repeat(spaces);
  return str.split('\n').map(l => (l.trim() ? pad + l : l)).join('\n');
}

function plural(name) {
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z')) return name + 'es';
  return name + 's';
}

// ─────────────────────────────────────────────────────────────────────────────
// KENDO FORM GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateKendoForm(model, options = {}) {
  const { controllerName } = resolveController(model, options);
  const fields = getFormFields(model);
  const idField = model.fields.find(f => f.isId);
  const idName = idField ? idField.name : 'Id';

  // Build items array
  const itemsJs = fields.map(f => buildFormItem(f)).join(',\n');

  // Build schema fields for datasource
  const schemaFields = fields.map(f => buildSchemaField(f)).join(',\n');

  const formCode = `
@model ${model.className}
@{
    ViewBag.Title = "${model.className} Form";
}

<div class="kendo-form-wrapper">
    <h2 class="form-title">@(Model.${idName} == 0 || Model.${idName} == default ? "Create" : "Edit") ${model.className}</h2>

    <div id="kendoForm"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {

    var model = @Html.Raw(Json.Serialize(Model));

    $("#kendoForm").kendoForm({
        formData: model,
        orientation: "vertical",
        items: [
${indent(itemsJs, 12)}
        ],
        validatable: {
            validateOnBlur: true,
            validationSummary: true,
            errorTemplate: "<span class='k-form-error'>#: message #</span>"
        },
        submit: function (ev) {
            ev.preventDefault();
            var data = ev.sender.toJSON();

            $.ajax({
                url: "@Url.Action(Model.${idName} == 0 ? "Create" : "Edit", "${controllerName}")",
                type: "POST",
                data: JSON.stringify(data),
                contentType: "application/json",
                success: function (response) {
                    if (response.success) {
                        kendo.alert("Saved successfully!");
                        window.location.href = "@Url.Action("Index", "${controllerName}")";
                    } else {
                        kendo.alert("Error: " + (response.message || "Unknown error"));
                    }
                },
                error: function (xhr) {
                    kendo.alert("Request failed: " + xhr.statusText);
                }
            });
        },
        clear: function () {
            kendo.confirm("Are you sure you want to clear the form?").then(function () {
                // form cleared
            });
        }
    });

});
</script>
}

<style>
    .kendo-form-wrapper {
        max-width: 720px;
        margin: 30px auto;
        padding: 30px;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .form-title {
        font-size: 1.4rem;
        font-weight: 600;
        margin-bottom: 24px;
        color: #333;
        border-bottom: 2px solid #ff6358;
        padding-bottom: 10px;
    }
</style>
`.trimStart();

  return formCode;
}

function buildFormItem(field) {
  const lines = [];
  lines.push(`field: "${field.name}"`);
  lines.push(`label: { text: "${field.label}", optional: ${!field.required} }`);
  lines.push(`editor: "${field.editor}"`);

  // Editor options
  const editorOpts = buildEditorOptions(field);
  if (editorOpts) lines.push(`editorOptions: ${editorOpts}`);

  // Validation
  const validation = buildValidation(field);
  if (validation) lines.push(`validation: ${validation}`);

  return `{\n${lines.map(l => '    ' + l).join(',\n')}\n}`;
}

function buildEditorOptions(field) {
  if (field.editor === 'NumericTextBox') {
    const opts = { min: 0 };
    if (field.decimals) { opts.decimals = field.decimals; opts.format = field.format || `n${field.decimals}`; }
    else { opts.format = 'n0'; }
    if (field.range) {
      const parts = field.range.split(',').map(s => s.trim());
      if (parts.length >= 2) { opts.min = parseFloat(parts[0]); opts.max = parseFloat(parts[1]); }
    }
    return JSON.stringify(opts);
  }
  if (field.editor === 'DatePicker' || field.editor === 'DateTimePicker') {
    return JSON.stringify({ format: field.editor === 'DateTimePicker' ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy' });
  }
  if (field.editor === 'TimePicker') {
    return JSON.stringify({ format: 'HH:mm' });
  }
  if (field.editor === 'TextBox' && field.email) {
    return JSON.stringify({ type: 'email' });
  }
  if (field.editor === 'TextBox' && field.maxLength) {
    return JSON.stringify({ maxLength: field.maxLength });
  }
  return null;
}

function buildValidation(field) {
  const rules = {};
  if (field.required) rules.required = true;
  if (field.email) rules.email = true;
  if (field.maxLength) rules.maxlength = field.maxLength;
  if (field.range) {
    const parts = field.range.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2) { rules.min = parts[0]; rules.max = parts[1]; }
  }
  return Object.keys(rules).length ? JSON.stringify(rules) : null;
}

function buildSchemaField(field) {
  const def = { type: field.kendoType };
  if (field.required) def.validation = { required: true };
  if (field.nullable) def.nullable = true;
  return `"${field.name}": ${JSON.stringify(def)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KENDO GRID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateKendoGrid(model, options = {}) {
  const { controllerName } = resolveController(model, options);
  const fields = getGridFields(model);
  const idField = model.fields.find(f => f.isId) || { name: 'Id' };

  const columns = fields
    .filter(f => !f.hidden)
    .map(f => buildGridColumn(f))
    .join(',\n');

  const schemaFields = fields.map(f => buildSchemaField(f)).join(',\n');

  return `
@{
    ViewBag.Title = "${plural(model.className)}";
}

<div class="kendo-grid-wrapper">
    <h2 class="grid-title">${plural(model.className)}</h2>
    <div id="kendoGrid"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {

    $("#kendoGrid").kendoGrid({
        dataSource: {
            transport: {
                read: {
                    url: "@Url.Action("Read", "${controllerName}")",
                    dataType: "json",
                    type: "POST",
                    contentType: "application/json"
                },
                create: {
                    url: "@Url.Action("Create", "${controllerName}")",
                    dataType: "json",
                    type: "POST",
                    contentType: "application/json"
                },
                update: {
                    url: "@Url.Action("Update", "${controllerName}")",
                    dataType: "json",
                    type: "POST",
                    contentType: "application/json"
                },
                destroy: {
                    url: "@Url.Action("Delete", "${controllerName}")",
                    dataType: "json",
                    type: "POST",
                    contentType: "application/json"
                },
                parameterMap: function (data, operation) {
                    if (operation !== "read" && data.models) {
                        return JSON.stringify(data.models);
                    }
                    return JSON.stringify(data);
                }
            },
            batch: false,
            pageSize: 20,
            serverPaging: true,
            serverSorting: true,
            serverFiltering: true,
            schema: {
                model: {
                    id: "${idField.name}",
                    fields: {
${indent(schemaFields, 24)}
                    }
                },
                data: "data",
                total: "total",
                errors: "errors"
            },
            error: function (e) {
                if (e.errors) {
                    var msg = "Errors:\\n";
                    $.each(e.errors, function (k, v) { msg += v.errors.join("\\n"); });
                    kendo.alert(msg);
                    this.cancelChanges();
                }
            }
        },
        height: 620,
        pageable: {
            refresh: true,
            pageSizes: [10, 20, 50, 100],
            buttonCount: 5
        },
        sortable: { mode: "multiple", allowUnsort: true },
        filterable: { mode: "row" },
        resizable: true,
        reorderable: true,
        columnMenu: true,
        toolbar: [
            { name: "create", text: "Add New ${model.className}" },
            { name: "excel", text: "Export to Excel" },
            { name: "pdf", text: "Export to PDF" },
            { template: '<input id="gridSearch" placeholder="Search..." class="k-textbox k-input" style="width:220px;" />' }
        ],
        excel: {
            fileName: "${plural(model.className)}.xlsx",
            allPages: true
        },
        pdf: {
            fileName: "${plural(model.className)}.pdf",
            allPages: true
        },
        editable: { mode: "popup", confirmation: true },
        columns: [
${indent(columns, 12)},
            {
                command: [
                    { name: "edit", text: "Edit" },
                    { name: "destroy", text: "Delete", iconClass: "k-icon k-i-trash" }
                ],
                title: "Actions",
                width: 160
            }
        ]
    });

    // Live search
    $("#gridSearch").on("input", kendo.throttle(function () {
        var grid = $("#kendoGrid").data("kendoGrid");
        var val = $(this).val();
        if (val.length > 1) {
            grid.dataSource.filter({
                logic: "or",
                filters: [
                    ${fields.filter(f => f.kendoType === 'string').slice(0, 3).map(f =>
      `{ field: "${f.name}", operator: "contains", value: val }`
    ).join(',\n                    ')}
                ]
            });
        } else {
            grid.dataSource.filter({});
        }
    }, 400));

});
</script>
}

<style>
    .kendo-grid-wrapper {
        margin: 20px;
    }
    .grid-title {
        font-size: 1.4rem;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
    }
    .k-grid .k-command-cell .k-button { margin: 0 2px; }
</style>
`.trimStart();
}

function buildGridColumn(field) {
  const col = { field: field.name, title: field.label };
  if (field.kendoType === 'date') {
    col.format = field.editor === 'DateTimePicker' ? '{0:MM/dd/yyyy HH:mm}' : '{0:MM/dd/yyyy}';
  }
  if (field.kendoType === 'number' && field.format) {
    col.format = `{0:${field.format}}`;
  }
  if (field.isId) col.hidden = true;
  const colStr = Object.entries(col)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
    .join(', ');
  return `{ ${colStr} }`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KENDO LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function generateKendoLogin() {
  return `
@{
    ViewBag.Title = "Login";
    Layout = null;
}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Login</title>
    <link rel="stylesheet" href="https://kendo.cdn.telerik.com/2024.1.130/styles/kendo.default-main.min.css" />
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-card {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            padding: 48px 40px;
            width: 100%;
            max-width: 420px;
        }
        .login-logo {
            text-align: center;
            margin-bottom: 8px;
        }
        .login-logo svg { width: 52px; height: 52px; }
        .login-title {
            text-align: center;
            font-size: 1.6rem;
            font-weight: 700;
            color: #1a1a2e;
            margin: 0 0 6px;
        }
        .login-subtitle {
            text-align: center;
            color: #888;
            font-size: 0.9rem;
            margin-bottom: 32px;
        }
        .k-form-field { margin-bottom: 18px; }
        .k-form-field label { font-weight: 500; color: #444; }
        .k-input { width: 100% !important; }
        .btn-login {
            width: 100%;
            padding: 12px;
            background: #2a5298;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            margin-top: 8px;
            transition: background 0.2s;
        }
        .btn-login:hover { background: #1e3c72; }
        .login-footer {
            text-align: center;
            margin-top: 20px;
            font-size: 0.88rem;
            color: #888;
        }
        .login-footer a { color: #2a5298; text-decoration: none; font-weight: 500; }
        #loginAlert { margin-bottom: 16px; display: none; }
        .spinner { display: none; }
        .btn-login.loading .spinner { display: inline-block; }
        .btn-login.loading .btn-text { display: none; }
    </style>
</head>
<body>
<div class="login-card">
    <div class="login-logo">
        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="26" fill="#2a5298"/>
            <path d="M26 14a8 8 0 100 16 8 8 0 000-16zm0 20c-8 0-14 4-14 6v2h28v-2c0-2-6-6-14-6z" fill="#fff"/>
        </svg>
    </div>
    <h1 class="login-title">Welcome Back</h1>
    <p class="login-subtitle">Sign in to your account</p>

    <div id="loginAlert"></div>

    <form id="loginForm" novalidate>
        <div class="k-form-field">
            <label for="Email">Email Address</label>
            <input id="Email" name="Email" type="email" class="k-textbox k-input" placeholder="you@example.com" />
            <span class="k-invalid-msg" data-for="Email"></span>
        </div>
        <div class="k-form-field">
            <label for="Password">Password</label>
            <input id="Password" name="Password" type="password" class="k-textbox k-input" placeholder="••••••••" />
            <span class="k-invalid-msg" data-for="Password"></span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;cursor:pointer;">
                <input type="checkbox" id="RememberMe" /> Remember me
            </label>
            <a href="@Url.Action("ForgotPassword","Account")" style="font-size:.9rem;color:#2a5298;text-decoration:none;">Forgot password?</a>
        </div>
        <button type="submit" class="btn-login" id="loginBtn">
            <span class="btn-text">Sign In</span>
            <span class="spinner">⏳</span>
        </button>
    </form>
    <div class="login-footer">
        Don't have an account? <a href="@Url.Action("Register","Account")">Create one</a>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://kendo.cdn.telerik.com/2024.1.130/js/kendo.all.min.js"></script>
<script>
$(document).ready(function () {
    var validator = $("#loginForm").kendoValidator({
        rules: {
            required: function (input) {
                if (input.is("[required]")) return $.trim(input.val()) !== "";
                return true;
            }
        }
    }).data("kendoValidator");

    // Add required attributes
    $("#Email").attr("required", true).attr("data-required-msg", "Email is required").attr("data-email-msg", "Enter a valid email");
    $("#Password").attr("required", true).attr("data-required-msg", "Password is required");

    $("#loginForm").on("submit", function (e) {
        e.preventDefault();
        if (!validator.validate()) return;

        var btn = $("#loginBtn").addClass("loading").prop("disabled", true);
        $("#loginAlert").hide();

        $.ajax({
            url: "@Url.Action("Login", "Account")",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                Email: $("#Email").val(),
                Password: $("#Password").val(),
                RememberMe: $("#RememberMe").prop("checked")
            }),
            success: function (res) {
                btn.removeClass("loading").prop("disabled", false);
                if (res.success) {
                    window.location.href = res.redirectUrl || "@Url.Action("Index","Home")";
                } else {
                    showAlert(res.message || "Invalid credentials. Please try again.", "error");
                }
            },
            error: function (xhr) {
                btn.removeClass("loading").prop("disabled", false);
                showAlert("Login failed: " + (xhr.responseJSON?.message || xhr.statusText), "error");
            }
        });
    });

    function showAlert(msg, type) {
        var icon = type === "error" ? "k-i-warning" : "k-i-check";
        var color = type === "error" ? "#d32f2f" : "#388e3c";
        $("#loginAlert")
            .html('<div style="background:' + (type==="error"?"#fdecea":"#e8f5e9") + ';border-left:4px solid ' + color + ';padding:12px 16px;border-radius:4px;color:' + color + ';font-size:.9rem;">' + msg + '</div>')
            .show();
    }
});
</script>
</body>
</html>
`.trimStart();
}

// ─────────────────────────────────────────────────────────────────────────────
// KENDO REGISTER PAGE
// ─────────────────────────────────────────────────────────────────────────────

function generateKendoRegister() {
  return `
@{
    ViewBag.Title = "Register";
    Layout = null;
}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Create Account</title>
    <link rel="stylesheet" href="https://kendo.cdn.telerik.com/2024.1.130/styles/kendo.default-main.min.css" />
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
        }
        .register-card {
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.3);
            padding: 48px 44px;
            width: 100%;
            max-width: 560px;
        }
        .register-header { text-align: center; margin-bottom: 36px; }
        .register-title { font-size: 1.8rem; font-weight: 700; color: #111; margin: 0 0 6px; }
        .register-subtitle { color: #888; font-size: 0.92rem; }
        .form-row { display: flex; gap: 16px; }
        .form-row .k-form-field { flex: 1; }
        .k-form-field { margin-bottom: 20px; }
        .k-form-field label { display: block; font-weight: 500; color: #444; margin-bottom: 5px; font-size: .9rem; }
        .k-form-field .k-invalid-msg { font-size: .82rem; color: #d32f2f; }
        .k-input, .k-textbox { width: 100% !important; }
        .section-divider {
            font-size: .78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #aaa;
            margin: 24px 0 18px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-divider::after { content: ''; flex: 1; height: 1px; background: #eee; }
        .password-strength { margin-top: 6px; height: 4px; border-radius: 2px; background: #eee; overflow: hidden; }
        .password-strength-bar { height: 100%; width: 0; transition: width .3s, background .3s; border-radius: 2px; }
        .btn-register {
            width: 100%;
            padding: 13px;
            background: linear-gradient(90deg, #0f2027, #2c5364);
            color: #fff;
            border: none;
            border-radius: 7px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: opacity 0.2s;
        }
        .btn-register:hover { opacity: 0.88; }
        .register-footer { text-align: center; margin-top: 20px; font-size: .88rem; color: #888; }
        .register-footer a { color: #2c5364; text-decoration: none; font-weight: 600; }
        #uploadPreview { display: none; margin-top: 10px; }
        #uploadPreview img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #2c5364; }
        #registerAlert { margin-bottom: 16px; display: none; }
    </style>
</head>
<body>
<div class="register-card">
    <div class="register-header">
        <h1 class="register-title">Create Account</h1>
        <p class="register-subtitle">Fill in your details to get started</p>
    </div>

    <div id="registerAlert"></div>

    <form id="registerForm" novalidate enctype="multipart/form-data">
        @Html.AntiForgeryToken()

        <div class="form-row">
            <div class="k-form-field">
                <label for="FirstName">First Name <span style="color:#d32f2f">*</span></label>
                <input id="FirstName" name="FirstName" type="text" class="k-textbox k-input"
                       placeholder="John" required data-required-msg="First name is required" />
                <span class="k-invalid-msg" data-for="FirstName"></span>
            </div>
            <div class="k-form-field">
                <label for="LastName">Last Name <span style="color:#d32f2f">*</span></label>
                <input id="LastName" name="LastName" type="text" class="k-textbox k-input"
                       placeholder="Doe" required data-required-msg="Last name is required" />
                <span class="k-invalid-msg" data-for="LastName"></span>
            </div>
        </div>

        <div class="k-form-field">
            <label for="Email">Email Address <span style="color:#d32f2f">*</span></label>
            <input id="Email" name="Email" type="email" class="k-textbox k-input"
                   placeholder="john.doe@example.com"
                   required data-required-msg="Email is required"
                   data-email-msg="Enter a valid email address" />
            <span class="k-invalid-msg" data-for="Email"></span>
        </div>

        <div class="k-form-field">
            <label for="PhoneNumber">Phone Number</label>
            <input id="PhoneNumber" name="PhoneNumber" type="tel" class="k-textbox k-input"
                   placeholder="+1 (555) 000-0000" />
        </div>

        <div class="k-form-field">
            <label for="DateOfBirth">Date of Birth</label>
            <input id="DateOfBirth" name="DateOfBirth" />
        </div>

        <div class="k-form-field">
            <label for="Gender">Gender</label>
            <input id="Gender" name="Gender" />
        </div>

        <div class="section-divider">Security</div>

        <div class="k-form-field">
            <label for="Password">Password <span style="color:#d32f2f">*</span></label>
            <input id="Password" name="Password" type="password" class="k-textbox k-input"
                   placeholder="Min 8 characters"
                   required data-required-msg="Password is required" />
            <div class="password-strength"><div class="password-strength-bar" id="pwStrengthBar"></div></div>
            <span class="k-invalid-msg" data-for="Password"></span>
        </div>

        <div class="k-form-field">
            <label for="ConfirmPassword">Confirm Password <span style="color:#d32f2f">*</span></label>
            <input id="ConfirmPassword" name="ConfirmPassword" type="password" class="k-textbox k-input"
                   placeholder="Re-enter password"
                   required data-required-msg="Please confirm your password" />
            <span class="k-invalid-msg" data-for="ConfirmPassword"></span>
        </div>

        <div class="section-divider">Profile Picture</div>

        <div class="k-form-field">
            <label>Upload Photo (optional)</label>
            <input id="profileUpload" name="ProfilePicture" type="file" accept="image/*" style="display:none" />
            <button type="button" class="k-button k-button-md" onclick="$('#profileUpload').click()">
                Choose Photo
            </button>
            <div id="uploadPreview">
                <img id="previewImg" src="#" alt="Preview" />
            </div>
        </div>

        <div class="k-form-field" style="display:flex;align-items:flex-start;gap:10px;">
            <input type="checkbox" id="AgreeTerms" name="AgreeTerms" required data-required-msg="You must accept the terms" />
            <label for="AgreeTerms" style="font-size:.9rem;cursor:pointer;">
                I agree to the <a href="#" style="color:#2c5364">Terms of Service</a> and
                <a href="#" style="color:#2c5364">Privacy Policy</a>
            </label>
        </div>
        <span class="k-invalid-msg" data-for="AgreeTerms"></span>

        <button type="submit" class="btn-register" id="registerBtn">Create My Account</button>
    </form>
    <div class="register-footer">
        Already have an account? <a href="@Url.Action("Login","Account")">Sign in</a>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://kendo.cdn.telerik.com/2024.1.130/js/kendo.all.min.js"></script>
<script>
$(document).ready(function () {

    // DatePicker for DOB
    $("#DateOfBirth").kendoDatePicker({
        format: "MM/dd/yyyy",
        max: new Date()
    });

    // DropDownList for Gender
    $("#Gender").kendoDropDownList({
        dataSource: ["Prefer not to say", "Male", "Female", "Non-binary", "Other"],
        optionLabel: "Select gender..."
    });

    // Kendo Validator
    var validator = $("#registerForm").kendoValidator({
        rules: {
            confirmpassword: function (input) {
                if (input.attr("id") === "ConfirmPassword") {
                    return input.val() === $("#Password").val();
                }
                return true;
            },
            minlength8: function (input) {
                if (input.attr("id") === "Password") {
                    return input.val().length >= 8;
                }
                return true;
            }
        },
        messages: {
            confirmpassword: "Passwords do not match",
            minlength8: "Password must be at least 8 characters"
        }
    }).data("kendoValidator");

    // Password strength meter
    $("#Password").on("input", function () {
        var pw = $(this).val();
        var score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        var colors = ["#d32f2f", "#f57c00", "#fbc02d", "#388e3c"];
        var widths = ["25%", "50%", "75%", "100%"];
        $("#pwStrengthBar")
            .css({ width: score > 0 ? widths[score - 1] : "0", background: score > 0 ? colors[score - 1] : "#eee" });
    });

    // Image preview
    $("#profileUpload").on("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { kendo.alert("Please select an image file."); return; }
        if (file.size > 5 * 1024 * 1024) { kendo.alert("Image must be less than 5MB."); return; }
        var reader = new FileReader();
        reader.onload = function (ev) {
            $("#previewImg").attr("src", ev.target.result);
            $("#uploadPreview").show();
        };
        reader.readAsDataURL(file);
    });

    // Form submit
    $("#registerForm").on("submit", function (e) {
        e.preventDefault();
        if (!validator.validate()) return;

        var btn = $("#registerBtn").prop("disabled", true).text("Creating account...");
        $("#registerAlert").hide();

        var formData = new FormData(this);

        $.ajax({
            url: "@Url.Action("Register", "Account")",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                btn.prop("disabled", false).text("Create My Account");
                if (res.success) {
                    showAlert("Account created! Redirecting...", "success");
                    setTimeout(function () {
                        window.location.href = res.redirectUrl || "@Url.Action("Index","Home")";
                    }, 1500);
                } else {
                    showAlert(res.message || "Registration failed. Please try again.", "error");
                }
            },
            error: function (xhr) {
                btn.prop("disabled", false).text("Create My Account");
                var msg = xhr.responseJSON?.message || xhr.statusText;
                showAlert("Error: " + msg, "error");
            }
        });
    });

    function showAlert(msg, type) {
        var bg = type === "error" ? "#fdecea" : "#e8f5e9";
        var border = type === "error" ? "#d32f2f" : "#388e3c";
        var color = border;
        $("#registerAlert")
            .html('<div style="background:' + bg + ';border-left:4px solid ' + border + ';padding:12px 16px;border-radius:4px;color:' + color + ';font-size:.9rem;">' + msg + '</div>')
            .show();
    }
});
</script>
</body>
</html>
`.trimStart();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function resolveController(model, options) {
  const controllerName = options.controllerName || plural(model.className);
  return { controllerName };
}

module.exports = {
  generateKendoForm,
  generateKendoGrid,
  generateKendoLogin,
  generateKendoRegister,
};
