"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { ArrowLeft, DollarSign, Calendar, User, MapPin, Loader, AlertCircle, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"

interface Payment {
  id: string
  amount: number
  createdAt?: string
}

interface Expense {
  id: string
  date?: string | Date
  description: string
  amount: number
  sourceType?: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  type: "MONTHLY_SERVICE" | "CLAIM"
  amount: number
  issuedAt: string
  totalPaid: number
  remainingBalance: number
  isPaid: boolean
  unit: {
    id: string
    name: string
    code: string
    project: {
      id: string
      name: string
    }
  }
  ownerAssociation: {
    id: string
    name: string
    phone?: string
    email?: string
  }
  payments: Payment[]
  expenses?: Expense[]
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "loading" || !session) return

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      router.replace("/dashboard")
      return
    }

    fetchInvoice()
  }, [session, status, invoiceId])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/invoices`)
      if (!res.ok) throw new Error("Failed to fetch invoices")
      
      const invoices = await res.json()
      const found = invoices.find((inv: Invoice) => inv.id === invoiceId)
      
      if (!found) {
        setError("Invoice not found")
        return
      }
      
      console.log("Invoice fetched:", found)
      console.log("Expenses:", found.expenses)
      
      setInvoice(found)
    } catch (err) {
      console.error("Error:", err)
      setError("An error occurred while fetching the invoice")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          رجوع
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "الفاتورة غير موجودة"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleDownloadPdf = async () => {
    if (!invoice) return

    try {
      setDownloading(true)
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) throw new Error("Failed to generate PDF")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const safe = (value: string) =>
        value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()

      const fileName = `${safe(invoice.unit.project.name)}-${safe(invoice.unit.name)}-${safe(invoice.invoiceNumber)}.pdf`

      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error generating PDF:", err)
      alert("حدث خطأ أثناء إنشاء ملف PDF")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div data-print-hide="true" className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          رجوع
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPdf}
          className="gap-2"
          disabled={downloading}
        >
          {downloading ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              تحميل PDF
            </>
          )}
        </Button>
      </div>

      <div
        data-print-root="true"
        className="space-y-6 bg-white border border-gray-200 rounded-xl p-6 md:p-8 max-w-[900px] mx-auto"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="CMDS"
              className="h-12 w-12 rounded-lg border border-gray-200 bg-white"
            />
            <div>
              <p className="text-xs text-gray-500">الجهة المُصدِرة</p>
              <p className="text-lg font-semibold text-gray-900">CMDS</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">فاتورة خدمات</div>
        </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">فاتورة رقم {invoice.invoiceNumber}</h1>
              <p className="text-gray-500 mt-2">
                {invoice.type === "MONTHLY_SERVICE" ? "خدمة شهرية" : "مطالبة"}
              </p>
            </div>
            <Badge className={invoice.isPaid ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]" : "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"}>
              {invoice.isPaid ? "مدفوعة" : "غير مدفوعة"}
            </Badge>
          </div>

      {/* Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              إجمالي الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.amount.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              إجمالي المدفوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.totalPaid.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              المتبقي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.remainingBalance.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>
      </div>

      {/* Project & Unit Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              بيانات المشروع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">المشروع</p>
              <p className="font-medium text-gray-900">{invoice.unit.project.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">الوحدة</p>
              <p className="font-medium text-gray-900">{invoice.unit.name}</p>
              <p className="text-xs text-gray-500">الكود: {invoice.unit.code}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              بيانات المالك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">الاسم</p>
              <p className="font-medium text-gray-900">{invoice.ownerAssociation.name}</p>
            </div>
            {invoice.ownerAssociation.email && (
              <div>
                <p className="text-sm text-gray-500">البريد الإلكتروني</p>
                <p className="font-medium text-sm text-gray-900">{invoice.ownerAssociation.email}</p>
              </div>
            )}
            {invoice.ownerAssociation.phone && (
              <div>
                <p className="text-sm text-gray-500">الهاتف</p>
                <p className="font-medium text-gray-900">{invoice.ownerAssociation.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issue Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            تاريخ الإصدار
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-gray-900">{format(new Date(invoice.issuedAt), "dd MMMM yyyy")}</p>
        </CardContent>
      </Card>

      {/* Invoice Details Table */}
      {invoice.expenses && invoice.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل المصاريف</CardTitle>
            <p className="text-sm text-gray-500 mt-1">تاريخ ووصف ومبلغ كل عنصر</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm">
                        {expense.date ? format(new Date(expense.date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{expense.description}</TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">
                        {expense.amount.toLocaleString()} ج.م
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-[#F9FAFB] font-semibold">
                    <TableCell colSpan={2} className="text-right">الإجمالي:</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {invoice.expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()} ج.م
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">سجل المدفوعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العملية</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.id.slice(0, 8)}...</TableCell>
                      <TableCell className="font-medium text-gray-900">{payment.amount.toFixed(2)} ج.م</TableCell>
                      <TableCell>
                        {payment.createdAt ? format(new Date(payment.createdAt), "dd MMM yyyy") : "غير متاح"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      </div>

      {/* Navigation Links (not in PDF) */}
      <div data-print-hide="true">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التنقل السريع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/dashboard/operational-units/${invoice.unit.id}`)}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                تفاصيل الوحدة
              </button>
              <button
                onClick={() => router.push(`/dashboard/payments?unit=${invoice.unit.id}`)}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                مدفوعات الوحدة
              </button>
              <button
                onClick={() => router.push("/dashboard/invoices")}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                الرجوع للفواتير
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
