import { execFile } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js')
import PDFDocument from 'pdfkit'
import { getCashDrawerConfig, getReceiptConfig } from './cash-drawer'
import type { PrintReceiptInput, ReceiptConfig } from '../../shared/types'

// Star TSP654: 72mm paper = ~204pt
const PAGE_WIDTH = 204

// ── PDF receipt builder ──────────────────────────────────────────────────────

function drawLine(doc: PDFKit.PDFDocument, paddingX: number): void {
  const y = doc.y + 2
  doc
    .moveTo(paddingX, y)
    .lineTo(PAGE_WIDTH - paddingX, y)
    .lineWidth(0.5)
    .stroke()
  doc.y = y + 4
}

function labelValue(doc: PDFKit.PDFDocument, label: string, value: string, paddingX: number): void {
  const contentWidth = PAGE_WIDTH - 2 * paddingX
  const y = doc.y
  doc.text(label, paddingX, y)
  doc.text(value, paddingX, y, { width: contentWidth, align: 'right' })
}

/**
 * Render all receipt content onto an already-created PDFDocument.
 * Extracted so it can be called twice: once to measure actual content height,
 * then again to produce the final output with the correctly-sized page.
 */
function renderContent(
  doc: PDFKit.PDFDocument,
  input: PrintReceiptInput,
  barcodePng: Buffer,
  cfg: ReceiptConfig
): void {
  const contentWidth = PAGE_WIDTH - 2 * cfg.paddingX
  const explicitFooter = input.footer_message?.trim()
  const footerMessage =
    explicitFooter && explicitFooter.length > 0 ? explicitFooter : cfg.footerMessage

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  const storeName = (cfg.storeName || input.store_name).toUpperCase()

  // ── Header ──────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(cfg.fontSize + 3)
  doc.text(storeName, { align: 'center' })
  doc.font('Helvetica').fontSize(cfg.fontSize)
  doc.text(`${dateStr}  ${timeStr}`, { align: 'center' })
  doc.text(`Cashier: ${input.cashier_name}`, { align: 'center' })
  doc.moveDown(0.3)
  drawLine(doc, cfg.paddingX)

  // ── Line items ──────────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(cfg.fontSize)
  for (const item of input.items) {
    const priceStr = `$${item.total_price.toFixed(2)}`
    const qtyStr = `x${item.quantity}`
    const rightText = `${qtyStr}  ${priceStr}`
    const rightWidth = doc.widthOfString(rightText)
    const nameMaxWidth = contentWidth - rightWidth - 4

    let name = item.product_name
    while (doc.widthOfString(name) > nameMaxWidth && name.length > 1) {
      name = name.slice(0, -1)
    }
    if (name.length < item.product_name.length) name += '~'

    const y = doc.y
    doc.text(name, cfg.paddingX, y)
    doc.text(rightText, cfg.paddingX, y, { width: contentWidth, align: 'right' })
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  doc.moveDown(0.2)
  drawLine(doc, cfg.paddingX)
  doc.font('Helvetica').fontSize(cfg.fontSize)

  const hasDiscount =
    input.discount_amount != null &&
    input.discount_amount > 0 &&
    input.subtotal_before_discount != null

  if (hasDiscount) {
    labelValue(doc, 'Subtotal:', `$${input.subtotal_before_discount!.toFixed(2)}`, cfg.paddingX)
    doc.font('Helvetica').fontSize(cfg.fontSize)
    labelValue(doc, 'Discount:', `-$${input.discount_amount!.toFixed(2)}`, cfg.paddingX)
  }

  labelValue(
    doc,
    hasDiscount ? 'Net Subtotal:' : 'Subtotal:',
    `$${input.subtotal.toFixed(2)}`,
    cfg.paddingX
  )
  labelValue(doc, 'Tax:', `$${input.tax_amount.toFixed(2)}`, cfg.paddingX)
  doc.font('Helvetica-Bold').fontSize(cfg.fontSize + 1)
  labelValue(doc, 'TOTAL:', `$${input.total.toFixed(2)}`, cfg.paddingX)

  // ── Payment ─────────────────────────────────────────────────────────────
  drawLine(doc, cfg.paddingX)
  doc.font('Helvetica').fontSize(cfg.fontSize)
  let payLabel = input.payment_method.toUpperCase()
  if (
    (input.payment_method === 'credit' || input.payment_method === 'debit') &&
    input.card_last_four
  ) {
    const brand = input.card_type
      ? input.card_type.charAt(0).toUpperCase() + input.card_type.slice(1) + ' '
      : ''
    payLabel = `${payLabel} (${brand}****${input.card_last_four})`
  }
  labelValue(doc, payLabel + ':', `$${input.total.toFixed(2)}`, cfg.paddingX)
  drawLine(doc, cfg.paddingX)

  // ── Barcode ─────────────────────────────────────────────────────────────
  doc.moveDown(0.5)
  const barcodeY = doc.y
  doc.image(barcodePng, cfg.paddingX, barcodeY, { fit: [contentWidth, 50] })
  // doc.image() with explicit x/y doesn't reliably advance doc.y — do it manually
  doc.y = barcodeY + 52

  // ── Footer message ───────────────────────────────────────────────────────
  if (footerMessage && footerMessage.trim().length > 0) {
    doc.moveDown(0.8)
    doc.font('Helvetica').fontSize(cfg.fontSize - 1)
    doc.text(footerMessage, cfg.paddingX, doc.y, {
      width: contentWidth,
      align: 'center'
    })
  }
}

/**
 * Pass 1 (measurement): render onto a throw-away 2000pt page and capture
 * the true final doc.y. All PDFKit content ops are synchronous, so doc.y is
 * accurate immediately after renderContent() returns — before doc.end().
 */
function measureContentHeight(
  input: PrintReceiptInput,
  barcodePng: Buffer,
  cfg: ReceiptConfig
): number {
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, 2000],
    margins: { top: cfg.paddingY, bottom: 0, left: cfg.paddingX, right: cfg.paddingX }
  })
  doc.on('data', () => {}) // discard — measurement only
  renderContent(doc, input, barcodePng, cfg)
  const finalY = doc.y
  doc.end()
  return finalY
}

function generateReceiptPdf(
  input: PrintReceiptInput,
  barcodePng: Buffer,
  cfg: ReceiptConfig
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Pass 1: measure exact content height so the page is sized to fit precisely
    const contentEndY = measureContentHeight(input, barcodePng, cfg)
    const pageHeight = Math.ceil(contentEndY + cfg.paddingY)

    // Pass 2: render into the correctly-sized page
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, pageHeight],
      margins: {
        top: cfg.paddingY,
        bottom: cfg.paddingY,
        left: cfg.paddingX,
        right: cfg.paddingX
      }
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    renderContent(doc, input, barcodePng, cfg)
    doc.end()
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function printReceipt(input: PrintReceiptInput): Promise<void> {
  const config = getCashDrawerConfig()
  if (!config || config.type !== 'usb') {
    throw new Error('Receipt printer not configured')
  }

  // Generate Code 128 barcode as PNG
  const barcodePng: Buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: input.transaction_number,
    scale: 2,
    height: 15,
    includetext: true,
    textxalign: 'center'
  })

  const cfg = getReceiptConfig()
  const pdf = await generateReceiptPdf(input, barcodePng, cfg)
  const tmpFile = join(tmpdir(), `receipt-${Date.now()}.pdf`)
  writeFileSync(tmpFile, pdf)

  // Single print job — CUPS renders the PDF through the Star raster driver
  return new Promise((resolve, reject) => {
    execFile(
      'lp',
      [
        '-d',
        config.printerName,
        '-o',
        'DocCutType=1PartialCutDoc',
        '-o',
        'PageCutType=0NoCutPage',
        tmpFile
      ],
      (err) => {
        try {
          unlinkSync(tmpFile)
        } catch {
          /* ignore cleanup errors */
        }
        if (err) reject(new Error(`Print failed: ${err.message}`))
        else resolve()
      }
    )
  })
}
