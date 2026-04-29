# 🚀 Kendo UI MVC Generator - VS Code Extension

Generate ready-to-use **Kendo UI (jQuery + ASP.NET MVC / .cshtml)** components using simple VS Code snippets.

This extension helps developers quickly create:

* Kendo Forms
* Kendo Grid CRUD
* Image Upload Grid
* Dropdown / ComboBox / MultiSelect
* Radio Button / Checkbox Editors
* DatePicker with validations
* File Upload Editor
* Grid Redirect Button
* Grid Column Formats
* Login / Register Forms

without writing repetitive boilerplate code.

---

# 📦 Installation

1. Open **Visual Studio Code**
2. Install the `.vsix` file

### Install from VSIX

* Open VS Code
* Go to **Extensions**
* Click `...` (top-right)
* Select **Install from VSIX**
* Choose:

```text
kendo-mvc-generator-2.0.1.vsix
```

---

# 🛠 Supported File Type

Use snippets inside:

```text
.cshtml
```

files (Razor Views)

Example:

```text
Views/Home/Index.cshtml
```

---

# ⚡ How to Use

Just type the snippet prefix and press:

```text
Tab
```

or

```text
Enter
```

VS Code will automatically generate the full code.

---

# 📘 Available Snippets

---

## 1. Kendo Register Form

### Prefix

```text
kendo-register
```

### Generates

* Full Kendo Form
* Validation
* Password + Confirm Password
* ComboBox
* MultiSelect
* Upload
* AJAX Submit

---

## 2. Kendo Login Form

### Prefix

```text
kendo-login
```

### Generates

* Login Form
* Email + Password
* Remember Me checkbox
* AJAX Login

---

## 3. Kendo Grid CRUD with Image Upload

### Prefix

```text
kendo-grid-crud
```

### Generates

* Full Kendo Grid
* Create / Read / Update / Delete
* Popup Editor
* Image Upload
* Notification
* parameterMap
* Auto refresh after save

---

# 🧾 Example Output (Grid)

When you type:

```text
kendo-grid-crud
```

it generates:

```cshtml
@{
    ViewData["Title"] = "Grid Template";
}

<div id="grid"></div>
<div id="notification"></div>

@section Scripts{
    <script>
        $(document).ready(function () {

            var dataSource = new kendo.data.DataSource({
                transport: {
                    read: {
                        url: "/Controller/Read",
                        dataType: "json"
                    }
                },

                pageSize: 5,

                schema: {
                    model: {
                        id: "Id",
                        fields: {
                            Id: {
                                type: "number"
                            },
                            Name: {
                                type: "string"
                            }
                        }
                    }
                }
            });

            $("#grid").kendoGrid({
                dataSource: dataSource,

                columns: [
                    {
                        field: "Id",
                        title: "ID"
                    },
                    {
                        field: "Name",
                        title: "Name"
                    }
                ],

                pageable: true,
                sortable: true,
                filterable: true
            });

        });
    </script>
}
```

---

## 4. Dropdown Editor

### Prefix

```text
kendo-dropdown-m
```

### Generates

```javascript
function typeDropDownEditor(container, options) {
    $('<input required name="' + options.field + '" />')
        .appendTo(container)
        .kendoDropDownList({
            dataTextField: "text",
            dataValueField: "value",
            optionLabel: "Select Type"
        });
}
```

---

## 5. Radio Button Editor

### Prefix

```text
kendo-radio-m
```

---

## 6. Checkbox Group Editor

### Prefix

```text
kendo-checkbox-m
```

---

## 7. MultiSelect Editor

### Prefix

```text
kendo-multiselect-m
```

---

## 8. Date Picker Editor

### Prefix

```text
kendo-date-editor
```

Also available:

```text
kendo-date-max
kendo-date-range
kendo-date-last7
kendo-date-next30
```

---

## 9. File Upload Editor

### Prefix

```text
kendo-file-upload
```

---

## 10. Grid Redirect Button

### Prefix

```text
kendo-grid-single
```

---

## 11. Grid Column Formats

### Prefix

```text
kendo-grid-formats
```

Includes:

* Date
* Time
* Currency
* Percentage
* Image
* Hyperlink
* Checkbox
* Boolean
* Status Badge
* Command Buttons

---

# 🎯 Why Use This Extension?

✔ Save development time
✔ No need to write boilerplate code
✔ Ready-to-use MVC structure
✔ Clean Kendo UI integration
✔ Popup CRUD support
✔ Upload + Validation support
✔ Best for Internship + Projects + Production work

---

# 📌 Requirements

Before using snippets, make sure your project has:

* jQuery
* Kendo UI scripts
* Kendo UI CSS
* ASP.NET MVC / ASP.NET Core MVC

Example:

```html
<link href="kendo.default-v2.min.css" rel="stylesheet" />
<script src="jquery.min.js"></script>
<script src="kendo.all.min.js"></script>
```

---

## Release Notes

### 2.0.1
- Updated snippet set with additional date range editors.
- Minor code generation fixes for Scheduler and TreeView scaffolds.

### 1.0.2
- Added context menu integration for `.cshtml` files.
- Improved model property type detection.

### 1.0.0
- Initial release with Grid, Form, Login, and Register generators.
- 10 core snippets included.

---

## License

This extension is licensed under the **MIT License**.

---


# 🚀 Happy Coding!

