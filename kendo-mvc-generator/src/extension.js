'use strict';

const vscode = require('vscode');
const path = require('path');
const { scanModels } = require('./modelParser');
const {
  generateKendoForm,
  generateKendoGrid,
  generateKendoLogin,
  generateKendoRegister,
} = require('./generators');

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let modelCache = [];
let statusBarItem;

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────
function activate(context) {
  console.log('[KendoMVC] Extension activated');

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(symbol-class) Kendo MVC';
  statusBarItem.tooltip = 'Generate Kendo MVC Component';
  statusBarItem.command = 'kendoMvc.generateComponent';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initial model scan
  refreshModelCache(context);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('kendoMvc.generateComponent', () => generateComponentCommand(context)),
    vscode.commands.registerCommand('kendoMvc.generateFromModel', () => generateFromModelCommand(context)),
    vscode.commands.registerCommand('kendoMvc.refreshModels', () => {
      refreshModelCache(context);
      vscode.window.showInformationMessage('[Kendo MVC] Model cache refreshed.');
    }),
  );

  // Watch for model file changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/Models/**/*.cs');
  watcher.onDidChange(() => refreshModelCache(context));
  watcher.onDidCreate(() => refreshModelCache(context));
  watcher.onDidDelete(() => refreshModelCache(context));
  context.subscriptions.push(watcher);

  // Completion provider for snippets in .cshtml files
  context.subscriptions.push(registerCompletionProvider());
}

// ─────────────────────────────────────────────────────────────────────────────
// Model cache
// ─────────────────────────────────────────────────────────────────────────────
function refreshModelCache(context) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const config = vscode.workspace.getConfiguration('kendoMvc');
  const modelsPath = config.get('modelsPath', 'Models');

  try {
    modelCache = scanModels(workspaceRoot, modelsPath);
    const count = modelCache.length;
    statusBarItem.text = `$(symbol-class) Kendo MVC (${count} model${count !== 1 ? 's' : ''})`;
    console.log(`[KendoMVC] Loaded ${count} model(s)`);
  } catch (e) {
    console.warn('[KendoMVC] Model scan error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main command: Generate Component
// ─────────────────────────────────────────────────────────────────────────────
async function generateComponentCommand(context) {
  // 1. Pick component type
  const componentItems = [
    { label: '$(table) Kendo Grid', description: 'Full CRUD grid with DataSource, paging, sorting, filtering', value: 'grid' },
    { label: '$(edit) Kendo Form', description: 'Dynamic form with validation, model-bound fields', value: 'form' },
    { label: '$(sign-in) Kendo Login', description: 'Complete login page with AJAX submit and validation', value: 'login' },
    { label: '$(person-add) Kendo Register', description: 'Full registration page with file upload and validation', value: 'register' },
    { label: '$(graph) Kendo Chart', description: 'Interactive chart with DataSource', value: 'chart' },
    { label: '$(list-ordered) Kendo ListView', description: 'Customizable list view with paging', value: 'listview' },
    { label: '$(panel) Kendo TabStrip', description: 'Tabbed content panel', value: 'tabstrip' },
    { label: '$(calendar) Kendo Scheduler', description: 'Full calendar/scheduler component', value: 'scheduler' },
    { label: '$(upload) Kendo Upload', description: 'Async file upload widget', value: 'upload' },
    { label: '$(symbol-namespace) Kendo TreeView', description: 'Hierarchical tree view', value: 'treeview' },
  ];

  const picked = await vscode.window.showQuickPick(componentItems, {
    placeHolder: 'Select Kendo UI component to generate',
    matchOnDescription: true,
  });
  if (!picked) return;

  const componentType = picked.value;

  // 2. For model-based components, pick a model
  let model = null;
  if (['grid', 'form'].includes(componentType)) {
    model = await pickModel();
    if (!model) return;
  }

  // 3. For grid/form, optionally override controller name
  let controllerName = null;
  if (model) {
    const defaultController = pluralize(model.className);
    const input = await vscode.window.showInputBox({
      prompt: 'Controller name (press Enter to use default)',
      value: defaultController,
      placeHolder: defaultController,
    });
    if (input === undefined) return; // cancelled
    controllerName = input || defaultController;
  }

  // 4. Generate code
  let code = '';
  try {
    switch (componentType) {
      case 'form':
        code = generateKendoForm(model, { controllerName });
        break;
      case 'grid':
        code = generateKendoGrid(model, { controllerName });
        break;
      case 'login':
        code = generateKendoLogin();
        break;
      case 'register':
        code = generateKendoRegister();
        break;
      case 'chart':
        code = generateKendoChart(model, controllerName);
        break;
      case 'listview':
        code = generateKendoListView(model, controllerName);
        break;
      case 'tabstrip':
        code = generateKendoTabStrip();
        break;
      case 'scheduler':
        code = generateKendoScheduler();
        break;
      case 'upload':
        code = generateKendoUpload(controllerName || 'Files');
        break;
      case 'treeview':
        code = generateKendoTreeView(controllerName || 'Items');
        break;
      default:
        vscode.window.showWarningMessage(`Component type "${componentType}" not yet implemented.`);
        return;
    }
  } catch (err) {
    vscode.window.showErrorMessage(`[Kendo MVC] Generation error: ${err.message}`);
    console.error(err);
    return;
  }

  // 5. Insert into editor or open new document
  await insertOrOpenCode(code, componentType, model);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate From Model command (right-click on .cs file)
// ─────────────────────────────────────────────────────────────────────────────
async function generateFromModelCommand(context) {
  if (modelCache.length === 0) {
    vscode.window.showWarningMessage('[Kendo MVC] No models found. Check your Models folder path in settings.');
    return;
  }
  await generateComponentCommand(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Model picker QuickPick
// ─────────────────────────────────────────────────────────────────────────────
async function pickModel() {
  if (modelCache.length === 0) {
    const choice = await vscode.window.showWarningMessage(
      '[Kendo MVC] No C# models found in the Models folder.',
      'Configure Models Path',
      'Continue Without Model',
    );
    if (choice === 'Configure Models Path') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'kendoMvc.modelsPath');
    }
    return null;
  }

  const items = modelCache.map(m => ({
    label: `$(symbol-class) ${m.className}`,
    description: `${m.fields.length} fields  •  ${path.basename(m.filePath)}`,
    detail: m.fields
      .filter(f => !f.isVirtual)
      .slice(0, 6)
      .map(f => `${f.name}: ${f.rawType}`)
      .join('  |  ') + (m.fields.length > 6 ? '  ...' : ''),
    model: m,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a C# model',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return picked ? picked.model : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert generated code into active editor or open new document
// ─────────────────────────────────────────────────────────────────────────────
async function insertOrOpenCode(code, componentType, model) {
  const editor = vscode.window.activeTextEditor;

  if (editor && (editor.document.languageId === 'razor' || editor.document.fileName.endsWith('.cshtml'))) {
    // Insert at cursor position
    const selection = editor.selection;
    await editor.edit(editBuilder => {
      editBuilder.replace(selection, code);
    });
    vscode.window.showInformationMessage(`✅ Kendo ${componentType} generated successfully!`);
  } else {
    // Open as new untitled document
    const modelName = model ? model.className : '';
    const suggestedName = model
      ? `${modelName}_${componentType}.cshtml`
      : `kendo-${componentType}.cshtml`;

    const doc = await vscode.workspace.openTextDocument({
      content: code,
      language: 'razor',
    });
    await vscode.window.showTextDocument(doc, { preview: false });

    // Offer to save
    const save = await vscode.window.showInformationMessage(
      `✅ Kendo ${componentType} generated! Save as ${suggestedName}?`,
      'Save File',
      'Keep as Untitled',
    );

    if (save === 'Save File') {
      await vscode.commands.executeCommand('workbench.action.files.saveAs');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IntelliSense Completion Provider
// ─────────────────────────────────────────────────────────────────────────────
function registerCompletionProvider() {
  return vscode.languages.registerCompletionItemProvider(
    [{ language: 'razor' }, { pattern: '**/*.cshtml' }],
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        const snippetTriggers = [
          { trigger: 'kendo-grid', label: 'kendo-grid', detail: 'Kendo UI Grid (model-aware)', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-form', label: 'kendo-form', detail: 'Kendo UI Form (model-aware)', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-login', label: 'kendo-login', detail: 'Kendo UI Login Page', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-register', label: 'kendo-register', detail: 'Kendo UI Register Page', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-chart', label: 'kendo-chart', detail: 'Kendo UI Chart', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-scheduler', label: 'kendo-scheduler', detail: 'Kendo UI Scheduler', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-upload', label: 'kendo-upload', detail: 'Kendo UI Upload', command: 'kendoMvc.generateComponent' },
          { trigger: 'kendo-treeview', label: 'kendo-treeview', detail: 'Kendo UI TreeView', command: 'kendoMvc.generateComponent' },
        ];

        if (!linePrefix.match(/kendo/i)) return undefined;

        return snippetTriggers.map(s => {
          const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Snippet);
          item.detail = s.detail;
          item.documentation = new vscode.MarkdownString(`**${s.label}**\n\nTriggers the Kendo MVC generator for \`${s.label}\`.`);
          item.command = {
            command: s.command,
            title: 'Generate Kendo Component',
          };
          item.sortText = '0' + s.label;
          return item;
        });
      },
    },
    '-',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Generators (Chart, ListView, TabStrip, Scheduler, Upload, TreeView)
// ─────────────────────────────────────────────────────────────────────────────

function generateKendoChart(model, controllerName) {
  const ctrl = controllerName || (model ? pluralize(model.className) : 'Data');
  const categoryField = model ? (model.fields.find(f => f.kendoType === 'string' && !f.isId) || model.fields[0]) : { name: 'Category' };
  const valueField = model ? (model.fields.find(f => f.kendoType === 'number' && !f.isId) || model.fields[1]) : { name: 'Value' };

  return `@{
    ViewBag.Title = "${ctrl} Chart";
}

<div class="kendo-chart-wrapper">
    <h2>${ctrl} Chart</h2>
    <div id="kendoChart"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoChart").kendoChart({
        title: { text: "${ctrl} Overview" },
        legend: { position: "bottom" },
        dataSource: {
            transport: {
                read: {
                    url: "@Url.Action("ChartData", "${ctrl}")",
                    dataType: "json"
                }
            },
            schema: {
                data: "data"
            }
        },
        series: [{
            type: "column",
            field: "${valueField ? valueField.name : 'Value'}",
            name: "${valueField ? valueField.label || valueField.name : 'Value'}"
        }],
        categoryAxis: {
            field: "${categoryField ? categoryField.name : 'Category'}",
            labels: { rotation: -45 }
        },
        valueAxis: {
            labels: { format: "{0}" }
        },
        tooltip: {
            visible: true,
            format: "{0}"
        }
    });
});
</script>
}

<style>
    .kendo-chart-wrapper { margin: 20px; }
    #kendoChart { height: 400px; }
</style>
`;
}

function generateKendoListView(model, controllerName) {
  const ctrl = controllerName || (model ? pluralize(model.className) : 'Items');
  const nameField = model ? (model.fields.find(f => f.kendoType === 'string' && !f.isId) || model.fields[0]) : { name: 'Name' };
  const idField = model ? (model.fields.find(f => f.isId) || { name: 'Id' }) : { name: 'Id' };

  return `@{
    ViewBag.Title = "${ctrl}";
}

<div class="listview-wrapper">
    <h2>${ctrl}</h2>
    <div id="kendoListView"></div>
    <div id="listViewPager"></div>
</div>

<script id="listViewTemplate" type="text/x-kendo-template">
    <div class="listview-item">
        <span class="item-id">##: ${idField.name} ##</span>
        <span class="item-name">##: ${nameField ? nameField.name : 'Name'} ##</span>
        <button class="k-button k-button-sm" onclick="editItem(##: ${idField.name} ##)">Edit</button>
    </div>
</script>

@section Scripts {
<script>
$(document).ready(function () {
    var ds = new kendo.data.DataSource({
        transport: {
            read: { url: "@Url.Action("Read", "${ctrl}")", dataType: "json", type: "POST" }
        },
        schema: { data: "data", total: "total" },
        pageSize: 12,
        serverPaging: true
    });

    $("#kendoListView").kendoListView({
        dataSource: ds,
        template: kendo.template($("#listViewTemplate").html()),
        selectable: true
    });

    $("#listViewPager").kendoPager({
        dataSource: ds
    });
});

function editItem(id) {
    window.location.href = "@Url.Action("Edit", "${ctrl}")/" + id;
}
</script>
}

<style>
    .listview-wrapper { margin: 20px; }
    .listview-item {
        display: flex; align-items: center; gap: 16px;
        padding: 12px 16px; border-bottom: 1px solid #eee;
        transition: background 0.15s;
    }
    .listview-item:hover { background: #f5f5f5; }
    .item-id { color: #aaa; font-size: .85rem; width: 40px; }
    .item-name { flex: 1; font-weight: 500; }
</style>
`;
}

function generateKendoTabStrip() {
  return `@{
    ViewBag.Title = "TabStrip";
}

<div class="tabstrip-wrapper">
    <div id="kendoTabStrip">
        <ul>
            <li class="k-active">Tab One</li>
            <li>Tab Two</li>
            <li>Tab Three</li>
        </ul>
        <div>
            <p>Content for <strong>Tab One</strong>. Replace with your Razor partial or content.</p>
        </div>
        <div>
            <p>Content for <strong>Tab Two</strong>.</p>
        </div>
        <div>
            <p>Content for <strong>Tab Three</strong>.</p>
        </div>
    </div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoTabStrip").kendoTabStrip({
        animation: { open: { effects: "fadeIn" } }
    });
});
</script>
}
`;
}

function generateKendoScheduler() {
  return `@{
    ViewBag.Title = "Scheduler";
}

<div class="scheduler-wrapper">
    <div id="kendoScheduler"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoScheduler").kendoScheduler({
        date: new Date(),
        height: 600,
        views: ["day", "week", { type: "month", selected: true }, "agenda"],
        dataSource: {
            batch: true,
            transport: {
                read:    { url: "@Url.Action("Read",   "Scheduler")", type: "POST", dataType: "json" },
                create:  { url: "@Url.Action("Create", "Scheduler")", type: "POST", dataType: "json" },
                update:  { url: "@Url.Action("Update", "Scheduler")", type: "POST", dataType: "json" },
                destroy: { url: "@Url.Action("Delete", "Scheduler")", type: "POST", dataType: "json" },
                parameterMap: function (data, type) {
                    return type !== "read" ? JSON.stringify(data.models) : data;
                }
            },
            schema: {
                model: {
                    id: "TaskId",
                    fields: {
                        TaskId:      { type: "number" },
                        title:       { from: "Title",       defaultValue: "No title" },
                        start:       { from: "Start",       type: "date" },
                        end:         { from: "End",         type: "date" },
                        description: { from: "Description" },
                        isAllDay:    { from: "IsAllDay",    type: "boolean" }
                    }
                }
            }
        }
    });
});
</script>
}

<style>
    .scheduler-wrapper { margin: 20px; }
</style>
`;
}

function generateKendoUpload(controllerName) {
  return `@{
    ViewBag.Title = "File Upload";
}

<div class="upload-wrapper">
    <h2>Upload Files</h2>
    <input name="files" id="kendoUpload" type="file" />
    <div id="uploadLog"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoUpload").kendoUpload({
        async: {
            saveUrl:   "@Url.Action("Save",   "${controllerName}")",
            removeUrl: "@Url.Action("Remove", "${controllerName}")",
            autoUpload: true
        },
        multiple: true,
        validation: {
            allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".docx", ".xlsx"],
            maxFileSize: 10485760  // 10 MB
        },
        success: function (e) {
            $("#uploadLog").prepend(
                '<div class="upload-success">✅ ' + e.files[0].name + ' uploaded successfully.</div>'
            );
        },
        error: function (e) {
            $("#uploadLog").prepend(
                '<div class="upload-error">❌ ' + e.files[0].name + ' failed: ' + e.XMLHttpRequest.statusText + '</div>'
            );
        }
    });
});
</script>
}

<style>
    .upload-wrapper { margin: 30px; max-width: 600px; }
    .upload-wrapper h2 { margin-bottom: 20px; }
    .upload-success { color: #388e3c; padding: 6px 0; font-size: .9rem; }
    .upload-error   { color: #d32f2f; padding: 6px 0; font-size: .9rem; }
</style>
`;
}

function generateKendoTreeView(controllerName) {
  return `@{
    ViewBag.Title = "TreeView";
}

<div class="treeview-wrapper">
    <h2>Tree View</h2>
    <div id="kendoTreeView"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoTreeView").kendoTreeView({
        checkboxes: { checkChildren: true },
        dataSource: {
            transport: {
                read: {
                    url: function (node) {
                        return "@Url.Action("Read", "${controllerName}")/" + (node.id || "");
                    },
                    dataType: "json"
                }
            },
            schema: { model: { id: "id", hasChildren: "hasChildren" } }
        },
        select: function (e) {
            var item = this.dataItem(e.node);
            console.log("Selected:", item.text, item.id);
        }
    });
});
</script>
}

<style>
    .treeview-wrapper { margin: 20px; max-width: 400px; }
</style>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function getWorkspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}

function pluralize(name) {
  if (!name) return 'Items';
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  if (/[sxz]$/.test(name) || /[cs]h$/.test(name)) return name + 'es';
  return name + 's';
}

function deactivate() {
  console.log('[KendoMVC] Extension deactivated');
}

module.exports = { activate, deactivate };
