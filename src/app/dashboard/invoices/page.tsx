"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { DollarSign, AlertCircle, Loader, X, Calendar, User, Building2, TrendingDown, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Project {
  id: string
  name: string
}

interface OperationalUnit {
  id: string
  name: string
  code: string
  projectId: string
  project: Project
}

interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  amount: number
  totalPaid: number
  remainingBalance: number
  isPaid: boolean
  issuedAt: string
  unitId: string
  unit: OperationalUnit
  ownerAssociation: {
    id: string
    name: string
  }
  payments: Array<{
    id: string
    amount: number
  }>
  expenses?: Array<{
    id: string
    date: string
    description: string
    amount: number
  }>
}

interface UnitContext {
  id: string
  name: string
  code: string
  isActive?: boolean
  monthlyManagementFee?: number
  monthlyBillingDay?: number
  project?: {
    id: string
    name: string
  }
  _count?: {
    residents: number
    tickets: number
    deliveryOrders: number
  }
}

export default function InvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = searchParams.get("unit")

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [unitContext, setUnitContext] = useState<UnitContext | null>(null)
  const [unitLoading, setUnitLoading] = useState(false)
  
  // Monthly billing state
  const [dueUnits, setDueUnits] = useState<any[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [showDueUnits, setShowDueUnits] = useState(false)
  const [generatingInvoices, setGeneratingInvoices] = useState(false)
  const [generationResult, setGenerationResult] = useState<any>(null)

  const isAuthorized = session?.user?.role === "ADMIN" || session?.user?.role === "ACCOUNTANT"

  useEffect(() => {
    setMounted(true)
    if (status === "loading" || !session) return

    if (!isAuthorized) {
      router.replace("/dashboard/unauthorized")
      return
    }

    fetchInvoices()
    fetchProjects()
    fetchDueUnits()
  }, [session, status, isAuthorized, router])

  useEffect(() => {
    if (!unitId) {
      setUnitContext(null)
      return
    }

    const fetchUnit = async () => {
      try {
        setUnitLoading(true)
        const res = await fetch(`/api/operational-units/${unitId}`)
        if (!res.ok) throw new Error("Failed to fetch unit")
        const data = await res.json()
        setUnitContext(data)
      } catch (err) {
        console.error("Error fetching unit:", err)
        setUnitContext(null)
      } finally {
        setUnitLoading(false)
      }
    }

    fetchUnit()
  }, [unitId])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/invoices")
      if (!res.ok) throw new Error("فشل تحميل الفواتير")
      const data = await res.json()
      setInvoices(data)
      
      // Update selectedInvoice if open
      if (selectedInvoice) {
        const updated = data.find((i: Invoice) => i.id === selectedInvoice.id)
        if (updated) setSelectedInvoice(updated)
      }
    } catch (err) {
      console.error("Error:", err)
      setError("فشل تحميل الفواتير")
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchDueUnits = async () => {
    try {
      setBillingLoading(true)
      const res = await fetch("/api/invoices/generate-monthly")
      if (res.ok) {
        const data = await res.json()
        setDueUnits(data.units || [])
      }
    } catch (error) {
      console.error("Error fetching due units:", error)
    } finally {
      setBillingLoading(false)
    }
  }

  const handleGenerateMonthlyInvoices = async () => {
    if (!confirm(`هل تريد توليد ${dueUnits.length} فاتورة شهرية؟`)) return

    try {
      setGeneratingInvoices(true)
      setGenerationResult(null)
      
      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })

      if (!res.ok) throw new Error("فشل توليد الفواتير")
      
      const data = await res.json()
      setGenerationResult(data)
      
      // Refresh invoices and due units
      await fetchInvoices()
      await fetchDueUnits()
      
      // Show result message
      if (data.summary.invoicesCreated > 0) {
        alert(`✅ تم توليد ${data.summary.invoicesCreated} فاتورة بنجاح!`)
      } else {
        alert("⚠️ لا توجد فواتير جديدة للتوليد")
      }
    } catch (err) {
      console.error("Error:", err)
      alert("❌ فشل توليد الفواتير")
    } finally {
      setGeneratingInvoices(false)
    }
  }

  const handleAddPayment = async () => {
    if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      setPaymentError("الرجاء إدخال مبلغ صحيح")
      return
    }

    const amount = Math.round(parseFloat(paymentAmount) * 100) / 100
    const remaining = selectedInvoice.remainingBalance

    // Allow small tolerance for floating point precision
    if (amount > remaining + 0.01) {
      setPaymentError(`الحد الأقصى: ${remaining.toFixed(2)} ج.م`)
      return
    }

    try {
      setPaymentLoading(true)
      setPaymentError(null)

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, invoiceId: selectedInvoice.id }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "فشل إضافة الدفعة")
      }

      // Refresh invoices
      await fetchInvoices()
      
      // Reset form
      setPaymentAmount("")
      setShowPaymentModal(false)
    } catch (err) {
      console.error("Error:", err)
      setPaymentError(err instanceof Error ? err.message : "فشل إضافة الدفعة")
    } finally {
      setPaymentLoading(false)
    }
  }

  // Get payment status
  const getPaymentStatus = (invoice: Invoice) => {
    // استخدم isPaid و totalPaid من الـ database - لا تحسب من payments array
    if (invoice.isPaid) return { status: "مدفوع بالكامل", color: "success", icon: "✓" }
    
    if (invoice.totalPaid === 0 || invoice.totalPaid === undefined) return { status: "غير مدفوع", color: "destructive", icon: "X" }
    return { status: "دفع جزئي", color: "warning", icon: "⏳" }
  }

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    if (unitId) {
      filtered = filtered.filter(inv => inv.unitId === unitId)
    }

    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.invoiceNumber.includes(searchTerm) ||
        inv.unit?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.unit?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.ownerAssociation?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (projectFilter !== "" && projectFilter !== "all") {
      filtered = filtered.filter(inv => inv.unit?.project?.id === projectFilter)
    }

    if (statusFilter !== "" && statusFilter !== "all-status") {
      filtered = filtered.filter(inv => {
        if (statusFilter === "paid") return inv.isPaid
        if (statusFilter === "unpaid") return inv.totalPaid === 0
        if (statusFilter === "partial") return !inv.isPaid && inv.totalPaid > 0
        return true
      })
    }

    return filtered.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
  }, [invoices, searchTerm, projectFilter, statusFilter, unitId])

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const paid = filteredInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0)
    const remaining = total - paid
    return {
      count: filteredInvoices.length,
      total: total.toFixed(2),
      paid: paid.toFixed(2),
      remaining: Math.max(0, remaining).toFixed(2) // Never show negative
    }
  }, [filteredInvoices])

  if (!mounted) return null

  if (session && !isAuthorized) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <DollarSign className="h-6 w-6 text-gray-600" />
            </div>
            الفواتير
          </h1>
          <p className="text-gray-500">
            {unitId ? "عرض فواتير الوحدة المحددة" : "إدارة والعرض كل الفواتير والمدفوعات"}
          </p>
        </div>

        {unitId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تفاصيل الوحدة</CardTitle>
            </CardHeader>
            <CardContent>
              {unitLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader className="h-4 w-4 animate-spin" />
                  جاري تحميل بيانات الوحدة...
                </div>
              ) : unitContext ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-700">
                    {unitContext.code}
                  </Badge>
                  <span className="font-semibold text-gray-900">{unitContext.name}</span>
                  {unitContext.project?.name && (
                    <Badge variant="secondary" className="text-xs">
                      {unitContext.project.name}
                    </Badge>
                  )}
                  {unitContext.isActive !== undefined && (
                    <Badge
                      className={
                        unitContext.isActive
                          ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                          : "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"
                      }
                      variant="outline"
                    >
                      {unitContext.isActive ? "نشطة" : "غير نشطة"}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">تعذر تحميل بيانات الوحدة</p>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {/* Monthly Billing Card */}
        {(session?.user?.role === "ADMIN" || session?.user?.role === "ACCOUNTANT") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                <Calendar className="h-5 w-5 text-gray-600" />
                الفواتير الشهرية المستحقة اليوم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader className="h-4 w-4 animate-spin" />
                  جاري التحقق...
                </div>
              ) : dueUnits.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-md">
                        <AlertTriangle className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-gray-900">{dueUnits.length}</p>
                        <p className="text-sm text-gray-500">وحدة مستحقة للفوترة</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDueUnits(!showDueUnits)}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {showDueUnits ? "إخفاء" : "عرض"} التفاصيل
                      </Button>
                      <Button
                        onClick={handleGenerateMonthlyInvoices}
                        disabled={generatingInvoices}
                        className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                      >
                        {generatingInvoices ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            جاري التوليد...
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 mr-2" />
                            توليد الفواتير الآن
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {showDueUnits && (
                    <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>الوحدة</TableHead>
                            <TableHead>المشروع</TableHead>
                            <TableHead>المالك</TableHead>
                            <TableHead>الرسوم الشهرية</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dueUnits.map((unit) => (
                            <TableRow key={unit.id}>
                              <TableCell className="font-semibold text-gray-900">
                                {unit.code} - {unit.name}
                              </TableCell>
                              <TableCell className="text-gray-500">{unit.projectName}</TableCell>
                              <TableCell className="text-gray-500">{unit.ownerName}</TableCell>
                              <TableCell className="font-semibold text-gray-900">
                                {unit.monthlyFee?.toFixed(2)} ج.م
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <CheckCircle2 className="h-5 w-5 text-gray-600" />
                  <span>لا توجد وحدات مستحقة للفوترة اليوم</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Invoices */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">إجمالي الفواتير</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.count}</p>
          </div>

          {/* Total Amount */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <TrendingDown className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">الإجمالي</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>

          {/* Paid Amount */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <CheckCircle2 className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">المدفوع</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.paid}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>

          {/* Remaining Amount */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <AlertTriangle className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">المتبقي</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.remaining}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">البحث والتصفية</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-2">البحث</label>
              <Input
                placeholder="ابحث برقم الفاتورة أو الوحدة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">المشروع</label>
                <Select value={projectFilter || "default"} onValueChange={(value) => {
                  if (value === "default") setProjectFilter("all")
                  else setProjectFilter(value)
                }}>
                  <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                    <SelectValue placeholder="جميع المشاريع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">جميع المشاريع</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">الحالة</label>
                <Select value={statusFilter || "default"} onValueChange={(value) => {
                  if (value === "default") setStatusFilter("all")
                  else setStatusFilter(value)
                }}>
                  <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">جميع الفواتير</SelectItem>
                    <SelectItem value="paid">مدفوع</SelectItem>
                    <SelectItem value="unpaid">غير مدفوع</SelectItem>
                    <SelectItem value="partial">دفع جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(searchTerm || projectFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setProjectFilter("all")
                  setStatusFilter("all")
                }}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                مسح التصفية
              </Button>
            )}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto opacity-50 mb-2 text-gray-400" />
              <p>لا توجد فواتير</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>المالك</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(invoice => {
                    const { status, color } = getPaymentStatus(invoice)

                    return (
                      <TableRow 
                        key={invoice.id} 
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                      >
                        <TableCell className="font-semibold text-gray-900">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-700">
                            {invoice.unit?.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">{invoice.ownerAssociation?.name}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(invoice.issuedAt).toLocaleDateString('ar-EG')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">
                          {invoice.amount.toFixed(2)} ج.م
                        </TableCell>
                        <TableCell className="text-right text-gray-900 font-semibold">
                          {invoice.totalPaid.toFixed(2)} ج.م
                        </TableCell>
                        <TableCell className="text-right text-gray-900 font-semibold">
                          {Math.max(0, invoice.remainingBalance).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              invoice.isPaid
                                ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                                : invoice.totalPaid === 0 
                                  ? "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"
                                  : "bg-[#FFFBEB] border border-[#F59E0B]/20 text-[#F59E0B]"
                            }
                            variant="outline"
                          >
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Invoice Detail Modal */}
        {selectedInvoice && (
          <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
            <DialogContent className="max-w-2xl bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-gray-600" />
                  تفاصيل الفاتورة
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Invoice Info */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-gray-900">معلومات الفاتورة</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">رقم الفاتورة</p>
                      <p className="text-gray-900 font-semibold">{selectedInvoice.invoiceNumber}</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">النوع</p>
                      <p className="text-gray-900 font-semibold">{selectedInvoice.type}</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> التاريخ
                      </p>
                      <p className="text-gray-900 font-semibold">{new Date(selectedInvoice.issuedAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1 flex items-center gap-1">
                        <User className="h-4 w-4" /> المالك
                      </p>
                      <p className="text-gray-900 font-semibold">{selectedInvoice.ownerAssociation?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Unit Info */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-gray-900">معلومات الوحدة</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1 flex items-center gap-1">
                        <Building2 className="h-4 w-4" /> الوحدة
                      </p>
                      <p className="text-gray-900 font-semibold">{selectedInvoice.unit?.name}</p>
                      <p className="text-gray-500 text-xs mt-1">({selectedInvoice.unit?.code})</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">المشروع</p>
                      <p className="text-gray-900 font-semibold">{selectedInvoice.unit?.project?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-gray-900">ملخص الدفع</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">الإجمالي</p>
                      <p className="text-gray-900 font-semibold text-xl">{selectedInvoice.amount.toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">ج.م</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">المدفوع</p>
                      <p className="text-gray-900 font-semibold text-xl">{selectedInvoice.totalPaid.toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">ج.م</p>
                    </div>
                    <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                      <p className="text-gray-500 text-sm mb-1">المتبقي</p>
                      <p className="text-gray-900 font-semibold text-xl">{Math.max(0, selectedInvoice.remainingBalance).toFixed(2)}</p>
                      <p className="text-gray-500 text-xs">ج.م</p>
                    </div>
                  </div>
                </div>

                {/* Expenses Table */}
                {selectedInvoice.expenses && selectedInvoice.expenses.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-gray-900">تفاصيل النفقات</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6]">
                            <th className="text-right text-gray-900 font-semibold py-3 px-4 text-[15px]">التاريخ</th>
                            <th className="text-right text-gray-900 font-semibold py-3 px-4 text-[15px]">الوصف</th>
                            <th className="text-right text-gray-900 font-semibold py-3 px-4 text-[15px]">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.expenses.map((expense) => (
                            <tr key={expense.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
                              <td className="text-gray-500 py-3 px-4 text-[14px]">
                                {new Date(expense.date).toLocaleDateString("ar-EG", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric"
                                })}
                              </td>
                              <td className="text-gray-500 py-3 px-4 text-[14px]">{expense.description}</td>
                              <td className="text-gray-900 font-semibold py-3 px-4 text-[14px]">{expense.amount.toLocaleString()} ج.م</td>
                            </tr>
                          ))}
                          <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                            <td colSpan={2} className="text-gray-900 font-semibold py-3 px-4">إجمالي النفقات</td>
                            <td className="text-gray-900 font-semibold py-3 px-4">
                              {selectedInvoice.expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()} ج.م
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payments List */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-gray-900">المدفوعات المسجلة</h3>
                    <div className="space-y-2">
                      {selectedInvoice.payments.map((payment, idx) => (
                        <div key={payment.id} className="flex justify-between items-center bg-gray-50 rounded-[12px] p-3 border border-[#E5E7EB]">
                          <span className="text-gray-500">دفعة {idx + 1}</span>
                          <span className="text-gray-900 font-semibold">{payment.amount.toFixed(2)} ج.م</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="flex justify-between items-center pt-4 border-t border-[#E5E7EB]">
                  <span className="text-gray-500">الحالة:</span>
                  <Badge
                    className={
                      selectedInvoice.isPaid
                        ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                        : selectedInvoice.totalPaid === 0 || selectedInvoice.totalPaid === undefined
                          ? "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"
                          : "bg-[#FFFBEB] border border-[#F59E0B]/20 text-[#F59E0B]"
                    }
                    variant="outline"
                  >
                    {getPaymentStatus(selectedInvoice).status}
                  </Badge>
                </div>

                {/* Add Payment Button */}
                {!selectedInvoice.isPaid && (
                  <Button
                    onClick={() => {
                      setPaymentAmount("")
                      setPaymentError(null)
                      setShowPaymentModal(true)
                    }}
                    className="w-full mt-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    <DollarSign className="h-4 w-4 ml-2" />
                    إضافة دفعة
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Add Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={(open) => {
          if (!open) {
            setShowPaymentModal(false)
            setPaymentAmount("")
            setPaymentError(null)
          }
        }}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl text-gray-900">إضافة دفعة</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Invoice Info */}
              <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                <p className="text-gray-500 text-sm mb-1">الفاتورة</p>
                <p className="text-gray-900 font-semibold">{selectedInvoice?.invoiceNumber}</p>
              </div>

              {/* Remaining Amount */}
              <div className="bg-gray-50 rounded-[12px] p-4 border border-[#E5E7EB]">
                <p className="text-gray-500 text-sm mb-1">المبلغ المتبقي</p>
                <p className="text-gray-900 font-semibold text-2xl">
                  {selectedInvoice ? selectedInvoice.remainingBalance.toFixed(2) : '0'} ج.م
                </p>
              </div>

              {/* Payment Amount Input */}
              <div className="space-y-2">
                <label className="text-gray-500 text-sm font-medium">المبلغ</label>
                <Input
                  type="number"
                  placeholder="أدخل المبلغ"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value)
                    setPaymentError(null)
                  }}
                  disabled={paymentLoading}
                  className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Error Message */}
              {paymentError && (
                <Alert className="bg-[#FEF2F2] border-[#DC2626]/30">
                  <AlertCircle className="h-4 w-4 text-[#DC2626]" />
                  <AlertDescription className="text-[#DC2626]">{paymentError}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPaymentAmount("")
                    setPaymentError(null)
                  }}
                  disabled={paymentLoading}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleAddPayment}
                  disabled={paymentLoading}
                  className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                >
                  {paymentLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin ml-2" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 ml-2" />
                      حفظ الدفعة
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
