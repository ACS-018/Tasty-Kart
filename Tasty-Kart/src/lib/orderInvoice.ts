import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Order } from '@/data/dummy'
import { formatDateTime } from '@/lib/utils'

function rupees(amount?: number | null) {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fileName(order: Order) {
  const number = (order.orderNumber || order.id || 'order').replace(/[^a-zA-Z0-9]+/g, '-')
  return `TastyKart-Invoice-${number}.pdf`
}

/** Builds the order invoice and opens it in a new tab. Downloads it if the tab is blocked. */
export function openOrderInvoice(order: Order) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(179, 43, 44)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('TastyKart', 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Tax Invoice', 14, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(order.orderNumber || order.id, pageWidth - 14, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(formatDateTime(order.createdAt), pageWidth - 14, 22, { align: 'right' })

  doc.setTextColor(26, 26, 46)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Customer', 14, 44)
  doc.text('Restaurant', 110, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(55, 65, 81)
  const customerLines = [
    order.customerName || '—',
    order.customerPhone || '',
    order.address || '',
  ].filter(Boolean)
  const restaurantLines = [
    order.restaurantName || '—',
    order.restaurantAddress || '',
    order.restaurantPhone || '',
  ].filter(Boolean)
  customerLines.forEach((line, index) => doc.text(line, 14, 51 + index * 5))
  restaurantLines.forEach((line, index) => doc.text(line, 110, 51 + index * 5))

  const items = Array.isArray(order.items) ? order.items : []
  autoTable(doc, {
    startY: 72,
    head: [['Item', 'Qty', 'Price', 'Amount']],
    body: items.length > 0
      ? items.map(item => {
          const qty = Number(item.qty) || 0
          const price = Number(item.price) || 0
          return [item.name || 'Item', String(qty), rupees(price), rupees(price * qty)]
        })
      : [['No items', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [179, 43, 44], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90
  const totals: Array<[string, string, boolean?]> = [
    ['Subtotal', rupees(order.subtotal)],
    ['Tax', rupees(order.tax)],
    ['Delivery fee', rupees(order.deliveryFee)],
    ['Platform fee', rupees(order.platformFee)],
  ]
  if ((order.discount ?? 0) > 0) {
    totals.push([`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `- ${rupees(order.discount)}`])
  }
  if (((order as any).tip ?? 0) > 0) {
    totals.push([`Tip (delivery partner)`, rupees((order as any).tip)])
  }
  if (((order as any).walletUsed ?? 0) > 0) {
    totals.push([`Wallet Credit Used`, `- ${rupees((order as any).walletUsed)}`])
  }
  totals.push(['Total', rupees(order.total), true])

  let y = finalY + 10
  totals.forEach(([label, value, isBold]) => {
    const isTotal = isBold === true
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
    doc.setFontSize(isTotal ? 12 : 10)
    doc.setTextColor(isTotal ? 179 : 55, isTotal ? 43 : 65, isTotal ? 44 : 81)
    doc.text(label, 120, y)
    doc.text(value, pageWidth - 14, y, { align: 'right' })
    y += isTotal ? 8 : 6
  })

  // Refund tag — shown on cancelled orders that have been refunded
  const refundAmount = (order as any).refundAmount ?? 0
  if (refundAmount > 0) {
    y += 2
    doc.setFillColor(220, 252, 231) // light green background
    doc.roundedRect(120, y - 4, pageWidth - 134, 8, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(21, 128, 61) // green-700
    doc.text(`✓ Refunded: ${rupees(refundAmount)} to wallet`, 122, y + 1)
    y += 12
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Payment: ${order.paymentMethod || '—'}`, 14, y)
  doc.text(`Status: ${order.status || '—'}`, 14, y + 5)
  if (order.deliveryPartnerName) {
    doc.text(`Delivery partner: ${order.deliveryPartnerName}`, 14, y + 10)
  }

  const name = fileName(order)
  doc.save(name)
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener')
}
