import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  revenueChartData,
  weeklyOrderData,
  customerGrowthData,
  topRestaurants,
  topFoods,
} from '@/data/dummy'
import { formatCurrency } from '@/lib/utils'

/** TastyKart brand theme */
export const BRAND = {
  name: 'TastyKart',
  tagline: 'Admin Analytics Report',
  primary: '#B32B2C',
  primaryRgb: [179, 43, 44] as [number, number, number],
  darkRgb: [26, 26, 46] as [number, number, number],
  mutedRgb: [107, 114, 128] as [number, number, number],
  lightBg: '#F8F8F8',
  success: '#22c55e',
}

export type ReportBrandOptions = {
  appName?: string
  tagline?: string
}

function fileStamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

function safeFileName(appName: string, ext: string) {
  const slug = appName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'TastyKart'
  return `${slug}-Report-${fileStamp()}.${ext}`
}

/** Draw branded square logo on canvas → PNG data URL for PDF */
function createLogoDataUrl(size = 128): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = size * 0.22

  // Rounded red square
  ctx.fillStyle = BRAND.primary
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(size, 0, size, size, r)
  ctx.arcTo(size, size, 0, size, r)
  ctx.arcTo(0, size, 0, 0, r)
  ctx.arcTo(0, 0, size, 0, r)
  ctx.closePath()
  ctx.fill()

  // "TK" monogram
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(size * 0.38)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TK', size / 2, size / 2 + size * 0.02)

  return canvas.toDataURL('image/png')
}

function summaryRows() {
  const totalRevenue = revenueChartData.reduce((s, r) => s + r.revenue, 0)
  const totalOrders = revenueChartData.reduce((s, r) => s + r.orders, 0)
  const newCustomers = customerGrowthData.reduce((s, r) => s + r.newCustomers, 0)
  const deliveries = weeklyOrderData.reduce((s, r) => s + r.delivered, 0)
  return [
    ['Total Revenue', formatCurrency(totalRevenue), '+18.2%'],
    ['Total Orders', totalOrders.toLocaleString('en-IN'), '+12.4%'],
    ['New Customers', newCustomers.toLocaleString('en-IN'), '+8.7%'],
    ['Deliveries (weekly sample)', deliveries.toLocaleString('en-IN'), '+10.1%'],
  ]
}

function drawPdfHeader(
  doc: jsPDF,
  logo: string,
  appName: string,
  tagline: string,
  pageWidth: number,
) {
  // Brand banner
  doc.setFillColor(...BRAND.primaryRgb)
  doc.rect(0, 0, pageWidth, 36, 'F')

  doc.addImage(logo, 'PNG', 12, 7, 22, 22)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(appName, 40, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 230, 230)
  doc.text(tagline, 40, 24)

  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  const generated = `Generated ${new Date().toLocaleString('en-IN')}`
  doc.text(generated, pageWidth - 12, 20, { align: 'right' })
}

function drawPdfFooter(doc: jsPDF, appName: string, pageWidth: number, pageHeight: number) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BRAND.primaryRgb)
    doc.setLineWidth(0.4)
    doc.line(12, pageHeight - 14, pageWidth - 12, pageHeight - 14)
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.primaryRgb)
    doc.setFont('helvetica', 'bold')
    doc.text(appName, 12, pageHeight - 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(`Confidential · Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 8, { align: 'right' })
  }
}

/** Export full analytics pack as branded PDF */
export async function exportReportsPdf(options: ReportBrandOptions = {}) {
  const appName = options.appName || BRAND.name
  const tagline = options.tagline || BRAND.tagline
  const logo = createLogoDataUrl()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  drawPdfHeader(doc, logo, appName, tagline, pageWidth)

  let y = 46
  doc.setTextColor(BRAND.darkRgb[0], BRAND.darkRgb[1], BRAND.darkRgb[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Executive Summary', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Change']],
    body: summaryRows(),
    theme: 'grid',
    headStyles: {
      fillColor: BRAND.primaryRgb,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(BRAND.darkRgb[0], BRAND.darkRgb[1], BRAND.darkRgb[2])
  doc.text('Monthly Revenue & Orders', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Month', 'Revenue (₹)', 'Orders']],
    body: revenueChartData.map(r => [
      r.month,
      r.revenue.toLocaleString('en-IN'),
      r.orders.toLocaleString('en-IN'),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primaryRgb, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  if (y > pageHeight - 60) {
    doc.addPage()
    drawPdfHeader(doc, logo, appName, tagline, pageWidth)
    y = 46
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Weekly Order Performance', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Day', 'Orders', 'Delivered', 'Cancelled']],
    body: weeklyOrderData.map(r => [
      r.day,
      String(r.orders),
      String(r.delivered),
      String(r.cancelled),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primaryRgb, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  })

  doc.addPage()
  drawPdfHeader(doc, logo, appName, tagline, pageWidth)
  y = 46

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(BRAND.darkRgb[0], BRAND.darkRgb[1], BRAND.darkRgb[2])
  doc.text('Customer Growth', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Month', 'New Customers', 'Returning']],
    body: customerGrowthData.map(r => [
      r.month,
      r.newCustomers.toLocaleString('en-IN'),
      r.returning.toLocaleString('en-IN'),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primaryRgb, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Top Restaurants', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Restaurant', 'Orders', 'Revenue (₹)', 'Rating']],
    body: topRestaurants.map(r => [
      r.name,
      r.orders.toLocaleString('en-IN'),
      r.revenue.toLocaleString('en-IN'),
      String(r.rating),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primaryRgb, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Top Food Items', 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Dish', 'Restaurant', 'Orders', 'Revenue (₹)']],
    body: topFoods.map(r => [
      r.name,
      r.restaurant,
      r.orders.toLocaleString('en-IN'),
      r.revenue.toLocaleString('en-IN'),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.primaryRgb, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  })

  drawPdfFooter(doc, appName, pageWidth, pageHeight)
  doc.save(safeFileName(appName, 'pdf'))
}

/** Export full analytics pack as branded Excel workbook */
export function exportReportsExcel(options: ReportBrandOptions = {}) {
  const appName = options.appName || BRAND.name
  const tagline = options.tagline || BRAND.tagline
  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: `${appName} Analytics Report`,
    Subject: tagline,
    Author: appName,
    CreatedDate: new Date(),
  }

  // Cover / Summary sheet
  const cover = [
    [appName],
    [tagline],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['Metric', 'Value', 'Change'],
    ...summaryRows(),
  ]
  const coverSheet = XLSX.utils.aoa_to_sheet(cover)
  coverSheet['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, coverSheet, 'Summary')

  const revenueSheet = XLSX.utils.json_to_sheet(
    revenueChartData.map(r => ({
      Month: r.month,
      Revenue: r.revenue,
      Orders: r.orders,
    })),
  )
  revenueSheet['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, revenueSheet, 'Revenue')

  const weeklySheet = XLSX.utils.json_to_sheet(
    weeklyOrderData.map(r => ({
      Day: r.day,
      Orders: r.orders,
      Delivered: r.delivered,
      Cancelled: r.cancelled,
    })),
  )
  weeklySheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Orders')

  const customersSheet = XLSX.utils.json_to_sheet(
    customerGrowthData.map(r => ({
      Month: r.month,
      'New Customers': r.newCustomers,
      Returning: r.returning,
    })),
  )
  customersSheet['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, customersSheet, 'Customers')

  const restaurantsSheet = XLSX.utils.json_to_sheet(
    topRestaurants.map(r => ({
      Restaurant: r.name,
      Orders: r.orders,
      Revenue: r.revenue,
      Rating: r.rating,
    })),
  )
  restaurantsSheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, restaurantsSheet, 'Top Restaurants')

  const foodsSheet = XLSX.utils.json_to_sheet(
    topFoods.map(r => ({
      Dish: r.name,
      Restaurant: r.restaurant,
      Orders: r.orders,
      Revenue: r.revenue,
    })),
  )
  foodsSheet['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, foodsSheet, 'Top Foods')

  XLSX.writeFile(wb, safeFileName(appName, 'xlsx'))
}
