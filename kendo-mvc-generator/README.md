# 🚀 Kendo UI MVC Generator — VS Code Extension

> Generate production-ready **Kendo UI** components for **ASP.NET MVC (.cshtml)** instantly.  
> Powered by intelligent C# model parsing — type `kendo-form`, pick your model, get full code.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Auto Model Detection** | Reads all `.cs` files from your `/Models` folder and parses properties, types, and attributes |
| **Smart Field Mapping** | Maps C# types → Kendo UI editors automatically (`DateTime` → DatePicker, `int` → NumericTextBox, etc.) |
| **Kendo Grid** | Full CRUD grid with server-side paging, sorting, filtering, Excel/PDF export |
| **Kendo Form** | Dynamic validated form with all fields auto-generated from model |
| **Login Page** | Complete login page with card UI, AJAX submit, Kendo Validator |
| **Register Page** | Full registration with file upload, password strength, confirm password |
| **10+ Snippets** | IntelliSense snippets for all major Kendo components |
| **Live Reload** | Model cache auto-refreshes when `.cs` files change |

---

## 📦 Installation

### From VSIX (manual install)
```bash
# 1. Package the extension
npm install -g vsce
cd kendo-mvc-generator
vsce package

# 2. Install in VS Code
code --install-extension kendo-mvc-generator-1.0.0.vsix
```

### From source (development)
```bash
git clone https://github.com/your-org/kendo-mvc-generator
cd kendo-mvc-generator
npm install
# Press F5 in VS Code to launch Extension Development Host
```

---

## 🎯 Quick Start

### Method 1: Type a snippet trigger

In any `.cshtml` file, type one of these triggers and press **Tab** or **Enter**:

```
kendo-grid        → Kendo Grid with CRUD DataSource
kendo-form        → Kendo Form with validation
kendo-login       → Complete Login page
kendo-register    → Complete Register page
kendo-chart       → Kendo Chart
kendo-datasource  → Kendo DataSource only
kendo-dropdown    → Kendo DropDownList
kendo-datepicker  → Kendo DatePicker
kendo-numeric     → Kendo NumericTextBox
kendo-upload      → Kendo Upload widget
kendo-window      → Kendo Window (modal)
kendo-scheduler   → Kendo Scheduler/Calendar
kendo-tabs        → Kendo TabStrip
kendo-notify      → Kendo Notification
kendo-validator   → Kendo Validator setup
kendo-ajax        → AJAX call with Kendo alerts
kendo-controller  → C# Controller CRUD methods
kendo-layout-scripts → CDN script/style tags
```

### Method 2: Command Palette

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: **`Generate Kendo MVC Component`**
3. Select component type
4. Select your C# model (for Grid/Form)
5. Confirm controller name
6. ✅ Full code is generated instantly

### Method 3: Status Bar

Click the **`⬡ Kendo MVC (N models)`** item in the bottom status bar.

### Method 4: Right-click Context Menu

Right-click in any `.cshtml` editor → **Generate Kendo MVC Component**

---

## 🔥 Model-Driven Generation

### Your C# Model

```csharp
// Models/Customer.cs
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
```

### Type `kendo-form` → Select "Customer" → Generated Output:

```html
@model Customer
@{ ViewBag.Title = "Customer Form"; }

<div class="kendo-form-wrapper">
    <div id="kendoForm"></div>
</div>

@section Scripts {
<script>
$(document).ready(function () {
    $("#kendoForm").kendoForm({
        formData: @Html.Raw(Json.Serialize(Model)),
        orientation: "vertical",
        items: [
            {
                field: "Name",
                label: { text: "Name", optional: false },
                editor: "TextBox",
                editorOptions: { maxLength: 100 },
                validation: { required: true, maxlength: 100 }
            },
            {
                field: "Email",
                label: { text: "Email", optional: false },
                editor: "TextBox",
                editorOptions: { type: "email" },
                validation: { required: true, email: true }
            },
            {
                field: "Age",
                label: { text: "Age", optional: true },
                editor: "NumericTextBox",
                editorOptions: { min: 0, format: "n0" }
            },
            {
                field: "CreatedDate",
                label: { text: "Created Date", optional: true },
                editor: "DatePicker",
                editorOptions: { format: "MM/dd/yyyy" }
            },
            {
                field: "IsActive",
                label: { text: "Is Active", optional: true },
                editor: "Switch"
            },
            {
                field: "Balance",
                label: { text: "Balance", optional: true },
                editor: "NumericTextBox",
                editorOptions: { decimals: 2, format: "c2" }
            }
        ],
        // ... validation, submit handler, AJAX ...
    });
});
</script>
}
```

---

## 🧠 Smart Type Mapping

| C# Type | Kendo Editor | Notes |
|---|---|---|
| `string` | TextBox | maxLength applied if `[MaxLength]` present |
| `int`, `long`, `short` | NumericTextBox | `format: "n0"` |
| `double`, `float` | NumericTextBox | `decimals: 2` |
| `decimal` | NumericTextBox | `decimals: 2`, `format: "c2"` |
| `DateTime` | DatePicker | `format: "MM/dd/yyyy"` |
| `DateTime?` | DatePicker | nullable: true |
| `DateTimeOffset` | DateTimePicker | `format: "MM/dd/yyyy HH:mm"` |
| `TimeSpan` | TimePicker | `format: "HH:mm"` |
| `bool` | Switch | — |
| `Guid` | TextBox | hidden: true |
| `[EmailAddress]` | TextBox | inputType: "email", email validation |

### Label Generation

| Property Name | Generated Label |
|---|---|
| `CreatedDate` | Created Date |
| `FirstName` | First Name |
| `IsActive` | Is Active |
| `EmailAddress` | Email Address |
| `PhoneNumber` | Phone Number |

---

## ⚙️ Configuration

Open Settings (`Ctrl+,`) and search for **Kendo MVC**:

| Setting | Default | Description |
|---|---|---|
| `kendoMvc.modelsPath` | `Models` | Relative path to models folder |
| `kendoMvc.defaultController` | *(auto)* | Override controller name |
| `kendoMvc.kendoCDN` | `https://kendo.cdn.telerik.com/2024.1.130` | Kendo CDN base URL |
| `kendoMvc.includeValidation` | `true` | Auto-include validation |
| `kendoMvc.dateFormat` | `MM/dd/yyyy` | Default date format |

Example `settings.json`:
```json
{
  "kendoMvc.modelsPath": "MyApp/Models",
  "kendoMvc.dateFormat": "dd/MM/yyyy",
  "kendoMvc.kendoCDN": "https://kendo.cdn.telerik.com/2024.3.1015"
}
```

---

## 📁 Project Structure

```
kendo-mvc-generator/
├── src/
│   ├── extension.js        ← VS Code entry point, commands, providers
│   ├── modelParser.js      ← C# model parser (core intelligence)
│   └── generators.js       ← Code generators for each component
├── snippets/
│   └── kendo-snippets.json ← 18 IntelliSense snippets
├── test/
│   └── runTests.js         ← Self-contained test suite (no deps)
├── package.json
└── README.md
```

---

## 🏗️ ASP.NET MVC Controller Setup

For the generated Grid to work, your controller needs these endpoints:

```csharp
using Kendo.Mvc.Extensions;
using Kendo.Mvc.UI;

public class CustomersController : Controller
{
    private readonly AppDbContext _db;
    public CustomersController(AppDbContext db) { _db = db; }

    public IActionResult Index() => View();

    [HttpPost]
    public JsonResult Read([DataSourceRequest] DataSourceRequest request)
        => Json(_db.Customers.ToDataSourceResult(request));

    [HttpPost]
    public JsonResult Create([DataSourceRequest] DataSourceRequest request, Customer model)
    {
        if (ModelState.IsValid) { _db.Customers.Add(model); _db.SaveChanges(); }
        return Json(new[] { model }.ToDataSourceResult(request, ModelState));
    }

    [HttpPost]
    public JsonResult Update([DataSourceRequest] DataSourceRequest request, Customer model)
    {
        if (ModelState.IsValid) { _db.Entry(model).State = EntityState.Modified; _db.SaveChanges(); }
        return Json(new[] { model }.ToDataSourceResult(request, ModelState));
    }

    [HttpPost]
    public JsonResult Delete([DataSourceRequest] DataSourceRequest request, Customer model)
    {
        var entity = _db.Customers.Find(model.Id);
        if (entity != null) { _db.Customers.Remove(entity); _db.SaveChanges(); }
        return Json(new[] { model }.ToDataSourceResult(request, ModelState));
    }
}
```

### NuGet Package Required
```xml
<PackageReference Include="Telerik.UI.for.AspNet.MVC5" Version="2024.1.130" />
<!-- OR for ASP.NET Core: -->
<PackageReference Include="Telerik.UI.for.AspNet.Core" Version="2024.1.130" />
```

---

## 🧪 Running Tests

```bash
node test/runTests.js
```

Expected output:
```
📦 toLabel — camelCase to human label
  ✅  CreatedDate → "Created Date"
  ✅  firstName  → "First Name"
  ...

📦 generateKendoForm — output validation
  ✅  Has @model directive
  ✅  Has kendoForm initialization
  ...

Results: 52 passed, 0 failed out of 52 assertions
🎉  All tests passed!
```

---

## 🔧 Supported Attributes

The parser respects these C# data annotation attributes:

| Attribute | Effect |
|---|---|
| `[Required]` | Sets `validation: { required: true }` |
| `[MaxLength(n)]` | Sets `maxLength` in editor options |
| `[EmailAddress]` | Sets `inputType: "email"`, adds email validation |
| `[Range(min, max)]` | Sets `min`/`max` in editor options |
| `[Display(Name = "...")]` | Overrides the generated label |
| `[Key]` | Marks field as the primary key (excluded from forms) |
| `[HiddenInput]` | Excludes field from form |
| `[ScaffoldColumn(false)]` | Excludes field from form |

---

## 📋 Commands Reference

| Command | Keyboard | Description |
|---|---|---|
| `Kendo MVC: Generate Kendo MVC Component` | — | Main generator flow |
| `Kendo MVC: Generate Kendo Component from Model` | — | Jump straight to model picker |
| `Kendo MVC: Refresh Model Cache` | — | Re-scan the Models folder |

---

## 🐛 Troubleshooting

**No models found**
- Check `kendoMvc.modelsPath` in settings (default: `Models`)
- Ensure models have `public` properties with `{ get; set; }`
- Run `Kendo MVC: Refresh Model Cache`

**Generated code not inserting**
- Make sure the active file is a `.cshtml` file
- If no file is open, the code opens as a new untitled Razor document

**Snippets not showing**
- Ensure the file language is set to `razor` (bottom status bar)
- For `.cshtml` files VS Code may detect as HTML — click the language selector and choose `ASP.NET Razor`

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## 🤝 Contributing

Pull requests welcome. Please add/update tests in `test/runTests.js` for any new features.

```bash
git checkout -b feature/my-new-component
# Make changes
node test/runTests.js
git commit -m "feat: add kendo-xyz generator"
git push origin feature/my-new-component
```
