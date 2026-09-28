import { useState } from 'react'
import { FileText, Download, Calendar, Filter, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ProtectedAction } from '@/components/shared/ProtectedAction'
import {
  generateFinanceReport,
  generateOperationsReport,
  exportFinanceToCSV,
  exportFinanceToPDF,
  exportFinanceToXLSX,
  exportOperationsToCSV,
  exportOperationsToPDF,
  exportOperationsToXLSX,
  type FinanceReport,
  type OperationsReport,
} from '@/lib/reportingService'

/**
 * REPORTS PAGE - Comprehensive reporting and export system
 * 
 * Features:
 * - Multiple report types (Finance, Operations)
 * - Date range selection
 * - Multiple export formats (CSV, PDF, XLSX)
 * - Scheduled reports
 * - Report history
 */

interface ScheduledReport {
  id: string
  name: string
  type: 'finance' | 'operations'
  frequency: 'daily' | 'weekly' | 'monthly'
  format: 'csv' | 'pdf' | 'xlsx'
  lastRun: string
  nextRun: string
  enabled: boolean
}

export function Reports() {
  const { success } = useToast()

  // State
  const [reportType, setReportType] = useState<'finance' | 'operations'>('finance')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('pdf')
  const [loading, setLoading] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<FinanceReport | OperationsReport | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduledReports] = useState<ScheduledReport[]>([
    {
      id: '1',
      name: 'Monthly Finance Report',
      type: 'finance',
      frequency: 'monthly',
      format: 'pdf',
      lastRun: '2026-09-01',
      nextRun: '2026-10-01',
      enabled: true,
    },
    {
      id: '2',
      name: 'Weekly Operations Report',
      type: 'operations',
      frequency: 'weekly',
      format: 'xlsx',
      lastRun: '2026-09-08',
      nextRun: '2026-09-15',
      enabled: true,
    },
  ])

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      const dateRange = {
        from: new Date(dateFrom),
        to: new Date(dateTo),
      }

      if (reportType === 'finance') {
        const report = await generateFinanceReport(dateRange)
        setGeneratedReport(report)
        success('Report generated', 'Finance report ready to export')
      } else {
        const report = await generateOperationsReport(dateRange)
        setGeneratedReport(report)
        success('Report generated', 'Operations report ready to export')
      }
    } catch (error: any) {
      success('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!generatedReport) return

    try {
      if (reportType === 'finance') {
        const financeReport = generatedReport as FinanceReport
        if (exportFormat === 'csv') {
          exportFinanceToCSV(financeReport)
        } else if (exportFormat === 'pdf') {
          exportFinanceToPDF(financeReport)
        } else {
          exportFinanceToXLSX(financeReport)
        }
      } else {
        const opsReport = generatedReport as OperationsReport
        if (exportFormat === 'csv') {
          exportOperationsToCSV(opsReport)
        } else if (exportFormat === 'pdf') {
          exportOperationsToPDF(opsReport)
        } else {
          exportOperationsToXLSX(opsReport)
        }
      }
      success('Export successful', `Report exported as ${exportFormat.toUpperCase()}`)
    } catch (error: any) {
      success('Error', error.message)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Reports & Analytics" description="Generate and export comprehensive business reports" />

      {/* Report Generator Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-red-600" />
            Generate Report
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {/* Report Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as 'finance' | 'operations')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="finance">Finance Report</option>
                <option value="operations">Operations Report</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'pdf' | 'xlsx')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={loading}
                className="w-full"
                size="sm"
              >
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>

          {/* Export Section */}
          {generatedReport && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {reportType === 'finance' ? 'Finance Report' : 'Operations Report'} Ready
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Generated: {new Date(generatedReport.generatedAt).toLocaleString()}
                  </p>
                </div>
                <ProtectedAction permission="VIEW_REPORTS">
                  <Button onClick={handleExport} icon={<Download size={16} />} size="sm">
                    Export as {exportFormat.toUpperCase()}
                  </Button>
                </ProtectedAction>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Report Preview */}
      {generatedReport && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Report Preview</h3>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {reportType === 'finance' ? (
                <>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs text-gray-600">Total Earnings</p>
                    <p className="text-xl font-bold text-green-600 mt-2">
                      ₹{(generatedReport as FinanceReport).summary.totalEarnings.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-gray-600">Total Payouts</p>
                    <p className="text-xl font-bold text-blue-600 mt-2">
                      ₹{(generatedReport as FinanceReport).summary.totalPayouts.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <p className="text-xs text-gray-600">Pending</p>
                    <p className="text-xl font-bold text-amber-600 mt-2">
                      ₹{(generatedReport as FinanceReport).summary.pendingPayouts.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs text-gray-600">Transactions</p>
                    <p className="text-xl font-bold text-purple-600 mt-2">
                      {(generatedReport as FinanceReport).summary.completedTransactions}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-gray-600">Total Partners</p>
                    <p className="text-xl font-bold text-blue-600 mt-2">
                      {(generatedReport as OperationsReport).summary.totalPartners}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs text-gray-600">Active</p>
                    <p className="text-xl font-bold text-green-600 mt-2">
                      {(generatedReport as OperationsReport).summary.activePartners}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs text-gray-600">Total Orders</p>
                    <p className="text-xl font-bold text-purple-600 mt-2">
                      {(generatedReport as OperationsReport).summary.totalOrders}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <p className="text-xs text-gray-600">Completion Rate</p>
                    <p className="text-xl font-bold text-amber-600 mt-2">
                      {(generatedReport as OperationsReport).summary.completionRate.toFixed(1)}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Scheduled Reports */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Scheduled Reports</h3>
            <ProtectedAction permission="VIEW_REPORTS">
              <Button onClick={() => setShowScheduleModal(true)} size="sm" variant="secondary">
                Add Schedule
              </Button>
            </ProtectedAction>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Report Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Frequency</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Format</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Last Run</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Next Run</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scheduledReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{report.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{report.frequency}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded bg-gray-100 text-xs font-semibold">
                        {report.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.lastRun}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.nextRun}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          report.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {report.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Schedule Modal */}
      <Modal open={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Schedule New Report" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Report Name</label>
            <Input placeholder="e.g., Monthly Finance Report" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Report Type</label>
            <select className="w-full px-3 py-2 border rounded-lg text-sm">
              <option>Finance Report</option>
              <option>Operations Report</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Frequency</label>
            <select className="w-full px-3 py-2 border rounded-lg text-sm">
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Export Format</label>
            <select className="w-full px-3 py-2 border rounded-lg text-sm">
              <option>PDF</option>
              <option>CSV</option>
              <option>XLSX</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">Schedule</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
