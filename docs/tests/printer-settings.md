# Printer Settings E2E Tests

**File:** `/tests/e2e/printer-settings.spec.ts`

## Overview

Comprehensive end-to-end tests for the printer settings modal in the LiquorPOS Electron app. These tests verify the complete workflow for configuring receipt printers, adjusting print layout parameters, and managing printer-related settings.

## Test Setup

### Mock API Configuration

The tests inject a mock `window.api` via `page.addInitScript()` to avoid hitting the real database. Key printer-related mock methods:

```typescript
listReceiptPrinters: async () => ['USB Printer', 'Network Printer', 'Thermal Printer']
getReceiptPrinterConfig: async () => ({ printerName: 'USB Printer' })
saveReceiptPrinterConfig: async () => {}
saveReceiptConfig: async () => {}
getPrinterStatus: async (printerName?: string) => ({
  connected: printerName === 'USB Printer' || printerName === 'Network Printer',
  printerName: printerName || 'USB Printer'
})
```

### Login Helper

All tests use the `loginWithPin` helper to navigate past the PIN entry screen and land on the POS screen where the printer settings button is accessible.

## Test Cases

### 1. Opens Printer Settings Modal from Header Settings Button
**ID:** `opens printer settings modal from header settings button`

**Objective:** Verify the printer settings modal can be opened from the settings dropdown in the header bar.

**Steps:**
1. Click the settings gear icon in the header
2. Click "Printer Settings" in the dropdown menu
3. Verify the modal title "Printer Settings" is visible

**Expected Result:** Modal opens with all sections visible (Receipt Printer, Printer Status, Receipt Printing, Store Name, etc.)

**Assertions:**
- Heading "Printer Settings" is visible
- Section "Receipt Printer" is visible

---

### 2. Displays Available Printers in Dropdown
**ID:** `displays available printers in dropdown`

**Objective:** Verify all installed printers are listed in the printer selection dropdown.

**Steps:**
1. Open the printer settings modal
2. Locate the "Receipt Printer" dropdown
3. Verify all three test printers are available as options

**Expected Result:** USB Printer, Network Printer, and Thermal Printer options exist in the dropdown.

**Assertions:**
- `option[value="USB Printer"]` has count 1
- `option[value="Network Printer"]` has count 1
- `option[value="Thermal Printer"]` has count 1

---

### 3. Updates Printer Status When Printer is Selected
**ID:** `updates printer status when printer is selected`

**Objective:** Verify printer connection status updates when a printer is selected.

**Steps:**
1. Open the printer settings modal
2. Select "USB Printer" from the printer dropdown
3. Wait for the status to refresh
4. Verify the status shows "Connected"

**Expected Result:** Printer Status section displays "Connected" for USB Printer.

**Assertions:**
- Text "Connected" is visible
- Status indicator shows connection state

---

### 4. Allows Editing Store Name and Footer Message
**ID:** `allows editing store name and footer message`

**Objective:** Verify text inputs for customizing receipt header and footer content.

**Steps:**
1. Open the printer settings modal
2. Enter "My Liquor Store" in the Store Name input
3. Enter "Thank you for shopping!" in the Footer Message input
4. Verify both values are retained

**Expected Result:** Both text inputs accept and display user input.

**Assertions:**
- Store Name input has value "My Liquor Store"
- Footer Message input has value "Thank you for shopping!"

---

### 5. Allows Adjusting Font Size with Increment/Decrement Buttons
**ID:** `allows adjusting font size with increment/decrement buttons`

**Objective:** Verify font size can be adjusted within valid range (8-16pt).

**Steps:**
1. Open the printer settings modal
2. Locate the Font Size stepper control
3. Click the "+" button to increase size from 10 to 11 pt
4. Click "+" again to increase to 12 pt
5. Click the "-" button to decrease back to 11 pt

**Expected Result:** Font size increments and decrements correctly within bounds.

**Assertions:**
- Initial font size shows "10 pt"
- After increment shows "11 pt"
- After second increment shows "12 pt"
- After decrement shows "11 pt"
- Decrement button is disabled when at minimum (8 pt)
- Increment button is disabled when at maximum (16 pt)

---

### 6. Allows Adjusting Receipt Margins (Padding)
**ID:** `allows adjusting receipt margins (padding)`

**Objective:** Verify receipt margin controls for top/bottom and left/right padding.

**Steps:**
1. Open the printer settings modal
2. Locate the Receipt Margins section
3. Increment Y-axis (top/bottom) padding from 4 to 6 pt
4. Increment X-axis (left/right) padding from 4 to 6 pt

**Expected Result:** Padding values update correctly in the visual box model diagram.

**Assertions:**
- Y-axis (top/bottom) padding shows "4 pt" initially
- Y-axis padding shows "6 pt" after increment
- X-axis (left/right) padding shows "4 pt" initially
- X-axis padding shows "6 pt" after increment

---

### 7. Toggles "Always Print" Checkbox
**ID:** `toggles "Always Print" checkbox`

**Objective:** Verify the "Always print receipt after payment" checkbox toggle.

**Steps:**
1. Open the printer settings modal
2. Locate the "Always print receipt after payment" checkbox
3. Verify it starts unchecked
4. Click to check the box
5. Click to uncheck the box

**Expected Result:** Checkbox state toggles correctly.

**Assertions:**
- Checkbox is initially unchecked
- After click, checkbox is checked
- After second click, checkbox is unchecked

---

### 8. Saves Receipt Configuration
**ID:** `saves receipt configuration`

**Objective:** Verify receipt and printer config can be saved successfully.

**Steps:**
1. Open the printer settings modal
2. Select "Network Printer" from dropdown
3. Enter "Updated Store Name" in Store Name field
4. Enter "Updated Footer" in Footer Message field
5. Click "Save Settings" button
6. Verify success modal appears

**Expected Result:** Success modal displays confirmation message.

**Assertions:**
- Success modal heading shows "Printer Settings Saved"
- Success message displays "Receipt printer and layout settings were saved successfully."

---

### 9. Print Sample Button Disabled State Changes Based on Printer Selection
**ID:** `print sample button disabled state changes based on printer selection`

**Objective:** Verify Print Sample button is only enabled when a printer is connected.

**Steps:**
1. Open the printer settings modal
2. Deselect the printer (select blank option)
3. Verify Print Sample button becomes disabled

**Expected Result:** Button is disabled when no printer is selected.

**Assertions:**
- Print Sample button is disabled

---

### 10. Print Sample Button is Enabled When Printer is Connected
**ID:** `print sample button is enabled when printer is connected`

**Objective:** Verify Print Sample button enables when a connected printer is selected.

**Steps:**
1. Open the printer settings modal
2. Select "USB Printer" (which is connected in mock)
3. Wait for status to update
4. Verify Print Sample button is enabled

**Expected Result:** Button is enabled and clickable.

**Assertions:**
- Print Sample button is not disabled
- Button is visible and interactive

---

### 11. Allows Selecting Different Sample Receipt Types
**ID:** `allows selecting different sample receipt types`

**Objective:** Verify all sample receipt types can be selected.

**Steps:**
1. Open the printer settings modal
2. Select "USB Printer"
3. Locate the "Test Print" sample type dropdown
4. Verify all four sample types are available
5. Select "With Discount" option

**Expected Result:** All sample types available and selectable.

**Assertions:**
- `option[value="basic"]` has count 1
- `option[value="with-promo"]` has count 1
- `option[value="many-items"]` has count 1
- `option[value="with-message"]` has count 1
- After selection, dropdown value is "with-promo"

---

### 12. Resets All Settings to Defaults
**ID:** `resets all settings to defaults`

**Objective:** Verify "Reset to Defaults" button reverts all changes.

**Steps:**
1. Open the printer settings modal
2. Make changes: enter store name, increase font size, check "Always Print"
3. Click "Reset to Defaults" button
4. Verify all values return to defaults

**Expected Result:** All settings reset to initial values.

**Assertions:**
- Store Name input is empty
- Font Size shows "10 pt"
- "Always Print" checkbox is unchecked

---

### 13. Closes Modal with Dismiss Button
**ID:** `closes modal with dismiss button`

**Objective:** Verify the modal can be closed via the Dismiss button.

**Steps:**
1. Open the printer settings modal
2. Verify modal is visible
3. Click "Dismiss" button
4. Verify modal is closed

**Expected Result:** Modal closes without saving changes.

**Assertions:**
- Modal heading "Printer Settings" is visible initially
- After clicking Dismiss, heading is not visible

---

## Test Execution

Run all printer settings tests:
```bash
npm run test:e2e -- printer-settings.spec.ts
```

Run a specific test:
```bash
npm run test:e2e -- printer-settings.spec.ts -g "allows editing store name"
```

Run in UI mode to debug:
```bash
npm run test:e2e:ui -- printer-settings.spec.ts
```

## Key Components Tested

- **HeaderBar** - Settings button and dropdown menu
- **PrinterSettingsModal** - Main modal component
- **Form Controls:**
  - Printer selection dropdown
  - Text inputs (Store Name, Footer Message)
  - Font size stepper (increment/decrement buttons)
  - Padding/margin steppers (Y and X axes)
  - Always Print checkbox
  - Sample receipt type dropdown

## Mock Data

### Available Printers
- USB Printer (connected)
- Network Printer (connected)
- Thermal Printer (not connected)

### Default Receipt Config
```typescript
{
  fontSize: 10,
  paddingY: 4,
  paddingX: 4,
  storeName: '',
  footerMessage: '',
  alwaysPrint: false
}
```

### Sample Receipt Types
- `basic` - Basic (2 items, cash)
- `with-promo` - With Discount
- `many-items` - Many Items (wrap test)
- `with-message` - With Footer Message

## Coverage

These tests cover:
- Modal opening/closing workflow
- Printer discovery and selection
- Receipt layout configuration (fonts, margins)
- Receipt content customization (store name, footer)
- Settings persistence (save/reset functionality)
- UI state management (button enable/disable based on selection)
- Error handling (failed save, printer load errors)

## Notes

- Tests use Playwright's strict mode to avoid flaky selectors
- Mock printer status polling happens every 4 seconds in the real component
- Tests use `waitFor()` for reliable element visibility checks
- Sample receipt types are hardcoded in the modal component (not dynamically generated)
- Font size range is 8-16 pt, padding range is 4-40 pt
