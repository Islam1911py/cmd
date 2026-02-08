"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { DollarSign, TrendingUp, Users, Loader, AlertCircle, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PayrollItem {
  id: string
  name: string
  salary: number
  advances: number
  net: number
}

interface Payroll {
  id: string
  month: string
  totalGross: number
  totalAdvances: number
  totalNet: number
  status: "PENDING" | "PAID"
  paidAt?: string
  payrollItems: PayrollItem[]
}

export default function PayrollPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isPaying, setIsPaying] = useState<string | null>(null)
  const [month, setMonth] = useState("")
  const [selectedMonth, setSelectedMonth] = useState("")

  useEffect(() => {
    if (status === "loading" || !session) return

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      router.replace("/dashboard")
      return
    }

    fetchPayrolls()
  }, [status, session])

  const fetchPayrolls = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/payroll")
      if (res.ok) {
        const data = await res.json()
        setPayrolls(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching payrolls:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!month) return

    try {
      setIsCreating(true)
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month })
      })

      if (res.ok) {
        setMonth("")
        setIsDialogOpen(false)
        fetchPayrolls()
      }
    } catch (error) {
      console.error("Error creating payroll:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handlePayPayroll = async (payrollId: string) => {
    try {
      setIsPaying(payrollId)
      const res = await fetch(`/api/payroll/${payrollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" })
      })

      if (res.ok) {
        fetchPayrolls()
      } else {
        const error = await res.json()
        console.error("Error paying payroll:", error)
      }
    } catch (error) {
      console.error("Error paying payroll:", error)
    } finally {
      setIsPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const totalGross = payrolls.reduce((sum, p) => sum + p.totalGross, 0)
  const totalAdvances = payrolls.reduce((sum, p) => sum + p.totalAdvances, 0)
  const totalNet = payrolls.reduce((sum, p) => sum + p.totalNet, 0)

  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <DollarSign className="h-6 w-6 text-gray-600" />
              </div>
              الرواتب الشهرية
            </h1>
            <p className="text-gray-500">إدارة ودفع رواتب الموظفين</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2">
                <Plus className="h-4 w-4" />
                راتب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-gray-900">إنشاء كشف رواتب جديد</DialogTitle>
                <DialogDescription className="text-gray-500">
                  حدد الشهر لإنشاء كشف الرواتب
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreatePayroll} className="space-y-4">
                <div>
                  <Label className="text-gray-500">الشهر</Label>
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="bg-white border-gray-200 text-gray-900 mt-2"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating || !month}
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    {isCreating ? "جاري الإنشاء..." : "إنشاء"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <TrendingUp className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">إجمالي الرواتب الأساسية</p>
            <p className="text-3xl font-semibold text-gray-900">{totalGross.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <AlertCircle className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">إجمالي السلفات المخصومة</p>
            <p className="text-3xl font-semibold text-gray-900">{totalAdvances.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">الراتب الصافي الإجمالي</p>
            <p className="text-3xl font-semibold text-gray-900">{totalNet.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>
        </div>

        {/* Payrolls List */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">كشوفات الرواتب</h2>

          {payrolls.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto opacity-50 mb-2 text-gray-400" />
              <p>لا توجد كشوفات رواتب</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payrolls.map((payroll) => (
                <div
                  key={payroll.id}
                  className="border border-[#E5E7EB] rounded-[12px] p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">شهر {payroll.month}</h3>
                      <p className="text-sm text-gray-500">
                        {payroll.payrollItems.length} موظف
                      </p>
                    </div>
                    <Badge
                      className={
                        payroll.status === "PAID"
                          ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                          : "bg-[#FFFBEB] border border-[#F59E0B]/20 text-[#F59E0B]"
                      }
                      variant="outline"
                    >
                      {payroll.status === "PAID" ? "مدفوع" : "معلق"}
                    </Badge>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الموظف</TableHead>
                          <TableHead className="text-right">الراتب الأساسي</TableHead>
                          <TableHead className="text-right">السلفات</TableHead>
                          <TableHead className="text-right">الصافي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payroll.payrollItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-gray-900 font-semibold">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right text-gray-500">
                              {item.salary.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900">
                              -{item.advances.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900 font-semibold">
                              {item.net.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 flex justify-between items-center text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500">
                        إجمالي الأساسي:{" "}
                        <span className="text-gray-900 font-semibold">
                          {payroll.totalGross.toFixed(2)}
                        </span>
                      </p>
                      <p className="text-gray-500">
                        إجمالي السلفات:{" "}
                        <span className="text-gray-900 font-semibold">
                          {payroll.totalAdvances.toFixed(2)}
                        </span>
                      </p>
                      <p className="text-gray-500">
                        الإجمالي الصافي:{" "}
                        <span className="text-gray-900 font-semibold">
                          {payroll.totalNet.toFixed(2)}
                        </span>
                      </p>
                    </div>

                    {payroll.status === "PENDING" && (
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600"
                        disabled={isPaying === payroll.id}
                        onClick={() => handlePayPayroll(payroll.id)}
                      >
                        {isPaying === payroll.id ? "جاري المعالجة..." : "تم الدفع"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
