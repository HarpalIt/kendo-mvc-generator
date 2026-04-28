'use strict';

const fs = require('fs');
const path = require('path');

/**
 * C# type → Kendo UI editor mapping
 */
const CSHARP_TYPE_MAP = {
  // String types
  string: { editor: 'TextBox', kendoType: 'string', inputType: 'text' },
  'system.string': { editor: 'TextBox', kendoType: 'string', inputType: 'text' },
  char: { editor: 'TextBox', kendoType: 'string', inputType: 'text' },

  // Numeric types
  int: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  'int32': { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  'int64': { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  long: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  short: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  byte: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' },
  double: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number', decimals: 2 },
  float: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number', decimals: 2 },
  decimal: { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number', decimals: 2, format: 'c2' },
  'system.decimal': { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number', decimals: 2, format: 'c2' },

  // Date / Time
  datetime: { editor: 'DatePicker', kendoType: 'date', inputType: 'date' },
  'datetime?': { editor: 'DatePicker', kendoType: 'date', inputType: 'date', nullable: true },
  'system.datetime': { editor: 'DatePicker', kendoType: 'date', inputType: 'date' },
  datetimeoffset: { editor: 'DateTimePicker', kendoType: 'date', inputType: 'datetime-local' },
  timespan: { editor: 'TimePicker', kendoType: 'date', inputType: 'time' },
  dateonly: { editor: 'DatePicker', kendoType: 'date', inputType: 'date' },
  timeonly: { editor: 'TimePicker', kendoType: 'date', inputType: 'time' },

  // Boolean
  bool: { editor: 'Switch', kendoType: 'boolean', inputType: 'checkbox' },
  boolean: { editor: 'Switch', kendoType: 'boolean', inputType: 'checkbox' },

  // Special
  guid: { editor: 'TextBox', kendoType: 'string', inputType: 'text', hidden: true },
  'system.guid': { editor: 'TextBox', kendoType: 'string', inputType: 'text', hidden: true },
};

/**
 * Fields that are typically IDs / auto-generated → skip in forms
 */
const AUTO_FIELDS = ['id', 'createdat', 'createddate', 'updatedat', 'updateddate', 'rowversion', 'timestamp'];

/**
 * Convert camelCase / PascalCase to human-readable label
 * e.g. "CreatedDate" → "Created Date", "firstName" → "First Name"
 */
function toLabel(fieldName) {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Resolve C# type string to a normalized key for lookup
 */
function normalizeType(rawType) {
  return rawType
    .replace(/\?$/, '')           // strip nullable ?
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/^system\./, '');    // strip System. prefix for common checks
}

/**
 * Resolve Kendo editor info for a given C# type string
 */
function resolveEditor(rawType) {
  const normalized = normalizeType(rawType);
  const isNullable = rawType.trim().endsWith('?');

  // Direct lookup (with nullable stripped)
  let info = CSHARP_TYPE_MAP[normalized]
    || CSHARP_TYPE_MAP['system.' + normalized]
    || null;

  if (!info) {
    // Fallback: if it ends with Id or looks like an enum → numeric
    if (normalized.endsWith('id')) {
      info = { editor: 'NumericTextBox', kendoType: 'number', inputType: 'number' };
    } else {
      // Unknown complex type → TextBox
      info = { editor: 'TextBox', kendoType: 'string', inputType: 'text' };
    }
  }

  return { ...info, nullable: isNullable || !!info.nullable };
}

/**
 * Parse a single C# model file and return structured field info
 * Supports:
 *  - public properties (auto-property syntax)
 *  - [Required], [MaxLength], [EmailAddress], [Range] attributes
 *  - Nullable<T> and T? syntax
 */
function parseModelFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract class name
  const classMatch = content.match(/public\s+(?:partial\s+)?class\s+(\w+)/);
  if (!classMatch) return null;

  const className = classMatch[1];
  const fields = [];

  // Split into lines for attribute tracking
  const lines = content.split('\n');
  let pendingAttributes = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Collect attributes on the line(s) before the property
    const attrMatch = line.match(/^\[(.+)\]$/);
    if (attrMatch) {
      pendingAttributes.push(attrMatch[1]);
      continue;
    }

    // Match: public <Type> <Name> { get; set; }
    // Also handles: public <Type>? <Name> { get; set; }
    // And: public virtual / override
    const propMatch = line.match(
      /public\s+(?:virtual\s+|override\s+|new\s+)?([A-Za-z][\w.<>, ?\[\]]*?)\s+(\w+)\s*\{\s*get\s*;\s*(?:(?:private|protected|internal)\s+)?set\s*;\s*\}/
    );

    if (propMatch) {
      const rawType = propMatch[1].trim();
      const name = propMatch[2].trim();
      const attrs = [...pendingAttributes];
      pendingAttributes = [];

      // Skip navigation properties (ICollection, IEnumerable, List<>, etc.)
      if (/^(?:ICollection|IEnumerable|IList|List|HashSet|ISet)</.test(rawType)) {
        continue;
      }

      // Skip virtual navigation properties (single entities)
      const isVirtual = line.includes('virtual');
      const editorInfo = resolveEditor(rawType);

      // Detect attributes
      const isRequired = attrs.some(a => /^Required/.test(a)) ||
        (!rawType.includes('?') && !['string', 'String'].includes(rawType.replace(/\?$/, '')) && editorInfo.kendoType !== 'string');
      const emailAttr = attrs.some(a => /EmailAddress|Email/.test(a));
      const maxLengthMatch = attrs.map(a => a.match(/MaxLength\((\d+)\)/)).find(Boolean);
      const rangeMatch = attrs.map(a => a.match(/Range\(([^)]+)\)/)).find(Boolean);
      const displayMatch = attrs.map(a => a.match(/Display\s*\(\s*Name\s*=\s*"([^"]+)"/)).find(Boolean);
      const keyAttr = attrs.some(a => /^Key$/.test(a));
      const hiddenAttr = attrs.some(a => /ScaffoldColumn\(false\)|HiddenInput/.test(a));

      const label = displayMatch ? displayMatch[1] : toLabel(name);
      const isAutoField = AUTO_FIELDS.includes(name.toLowerCase());
      const isId = keyAttr || name.toLowerCase() === 'id' || /Id$/.test(name);

      fields.push({
        name,
        label,
        rawType,
        type: normalizeType(rawType),
        editor: emailAttr ? 'TextBox' : editorInfo.editor,
        kendoType: editorInfo.kendoType,
        inputType: emailAttr ? 'email' : editorInfo.inputType,
        nullable: editorInfo.nullable || rawType.includes('?') || editorInfo.kendoType === 'string',
        required: isRequired && !editorInfo.nullable,
        email: emailAttr,
        maxLength: maxLengthMatch ? parseInt(maxLengthMatch[1]) : null,
        range: rangeMatch ? rangeMatch[1] : null,
        decimals: editorInfo.decimals || null,
        format: editorInfo.format || null,
        isId,
        isAutoField,
        hidden: hiddenAttr || editorInfo.hidden || false,
        isVirtual,
        attributes: attrs,
      });
    } else {
      // Reset pending attrs if the line is not a property
      if (line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('[')) {
        pendingAttributes = [];
      }
    }
  }

  return { className, fields, filePath };
}

/**
 * Scan the workspace Models folder and return all parsed models
 */
function scanModels(workspaceRoot, modelsRelPath = 'Models') {
  const modelsDir = path.join(workspaceRoot, modelsRelPath);
  if (!fs.existsSync(modelsDir)) return [];

  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.cs')) {
        try {
          const model = parseModelFile(fullPath);
          if (model && model.fields.length > 0) {
            results.push(model);
          }
        } catch (e) {
          console.warn(`[KendoMVC] Failed to parse ${fullPath}: ${e.message}`);
        }
      }
    }
  }

  walk(modelsDir);
  return results;
}

/**
 * Get display fields only (exclude ID and virtual nav props for forms)
 */
function getFormFields(model) {
  return model.fields.filter(f => !f.isId && !f.isVirtual && !f.hidden);
}

/**
 * Get all non-virtual fields for grids (include ID for data binding)
 */
function getGridFields(model) {
  return model.fields.filter(f => !f.isVirtual);
}

module.exports = {
  parseModelFile,
  scanModels,
  getFormFields,
  getGridFields,
  toLabel,
  resolveEditor,
  CSHARP_TYPE_MAP,
};
