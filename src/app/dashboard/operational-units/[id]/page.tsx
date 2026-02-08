"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { AlertCircle, Loader, Plus, Edit, DollarSign, Users, FileText, MapPin, Calendar, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface UnitData {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
  monthlyManagementFee?: number | null
  monthlyBillingDay?: number | null
  project: {
    id: string
    name: string
  }
}

interface Resident {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

interface Ticket {
  id: string
  title: string
  status: string
  priority: string
  resident: { id: string; name: string }
  assignedTo?: { id: string; name: string }
  createdAt: string
}

interface TechWork {
  id: string
  description: string
  amount: number
  paymentStatus: string
  technician: { name: string }
  createdAt: string
}

interface UnitExpense {
  id: string
  description: string
  amount: number
  sourceType?: string
  date: string
  isClaimed: boolean
  claimInvoice?: {
    id: string
    invoiceNumber: string
  } | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  amount: number
  issuedAt: string
  unitId: string
  ownerAssociation?: {
    id: string
    name: string
  }
  payments?: Array<{
    id: string
    amount: number
  }>
}

interface UnitSummary {
  unit: {
    id: string
    name: string
    code: string
    type: string
    isActive: boolean
    project: {
      id: string
      name: string
    }
  }
  residents: {
    total: number
    activeTickets: number
    pendingDeliveries: number
  }
  tickets: {
    total: number
    new: number
    inProgress: number
    done: number
  }
  deliveries: {
    total: number
    new: number
    inProgress: number
    delivered: number
  }
  expenseNotes: {
    total: number
    pending: number
    recorded: number
    totalAmount: number
  }
  technicianWork: {
    total: number
    paid: number
    unpaid: number
    totalCost: number
    paidAmount: number
    unpaidAmount: number
  }
  staffPayroll: {
    totalStaff: number
    activeStaff: number
    workLogCount: number
    totalCost: number
    paidAmount: number
    unpaidAmount: number
  }
  invoices: {
    total: number
    paid: number
    unpaid: number
    partial: number
    totalAmount: number
    totalPaid: number
  }
  remainingBalance: number
  totalOperationalCosts: number
  totalCostsPaid: number
  totalCostsUnpaid: number
}

interface Resident {
  id: string
  name: string
  email: string
  phone: string
  address: string
  unit?: {
    id: string
    name: string
  }
}

interface DeliveryOrder {
  id: string
  title: string
  description: string
  status: string
  recipient: string
  phone: string
  address: string
  createdAt: string
  updatedAt: string
}

export default function OperationalUnitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const unitId = params.id as string

  const [unit, setUnit] = useState<UnitData | null>(null)
  const [residents, setResidents] = useState<Resident[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [techWork, setTechWork] = useState<TechWork[]>([])
  const [expenses, setExpenses] = useState<UnitExpense[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<UnitSummary | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")

  // Monthly billing state
  const [editBillingDialog, setEditBillingDialog] = useState(false)
  const [savingBilling, setSavingBilling] = useState(false)
  const [tempFee, setTempFee] = useState<number>(0)
  const [tempDay, setTempDay] = useState<number>(1)

  // Edit unit name state
  const [editNameDialog, setEditNameDialog] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [tempName, setTempName] = useState<string>("")

  // Add resident state
  const [addResidentDialog, setAddResidentDialog] = useState(false)
  const [savingResident, setSavingResident] = useState(false)
  const [newResident, setNewResident] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  })

  const isPM = session?.user?.role === "PROJECT_MANAGER"
  const isAccountant = session?.user?.role === "ACCOUNTANT"
  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchUnitData()
  }, [session, status, unitId])

  // Auto-refresh when returning to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session) {
        fetchUnitData()
      }
    }

    const handleFocus = () => {
      if (session) {
        fetchUnitData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session, unitId])

  const fetchUnitData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/summary/unit/${unitId}`)
      if (!res.ok) throw new Error("Failed to fetch unit")
      const data = await res.json()
      setSummary(data)
      
      // Extract unit info from summary
      if (data.unit) {
        setUnit(data.unit)
        setTempFee(data.unit.monthlyManagementFee || 0)
        setTempDay(data.unit.monthlyBillingDay || 1)
        setTempName(data.unit.name || "")
      }

      // Fetch related data in parallel
      const [residentsRes, ticketsRes, workRes, expensesRes, invoicesRes] = await Promise.all([
        fetch(`/api/operational-units/${unitId}/residents`),
        fetch(`/api/tickets?unitId=${unitId}`),
        fetch(`/api/technician-work?unitId=${unitId}`),
        fetch(`/api/unit-expenses?unitId=${unitId}`),
        fetch(`/api/invoices?unitId=${unitId}`),
      ])

      if (residentsRes.ok) setResidents(await residentsRes.json())
      if (ticketsRes.ok) setTickets(await ticketsRes.json())
      if (workRes.ok) setTechWork(await workRes.json())
      if (expensesRes.ok) setExpenses(await expensesRes.json())
      if (invoicesRes.ok) setInvoices(await invoicesRes.json())
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load unit details")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBilling = async () => {
    if (!unit) return

    setSavingBilling(true)
    try {
      const res = await fetch(`/api/operational-units/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyManagementFee: tempFee,
          monthlyBillingDay: tempDay,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setUnit({ ...unit, monthlyManagementFee: tempFee, monthlyBillingDay: tempDay })
        setEditBillingDialog(false)
        alert("تم تحديث بيانات الفوترة الشهرية بنجاح")
      } else {
        alert("فشل تحديث بيانات الفوترة")
      }
    } catch (err) {
      console.error("Error:", err)
      alert("حدث خطأ أثناء التحديث")
    } finally {
      setSavingBilling(false)
    }
  }

  const handleSaveUnitName = async () => {
    if (!unit) return
    if (!tempName.trim()) {
      alert("الرجاء إدخال اسم الوحدة")
      return
    }

    setSavingName(true)
    try {
      const res = await fetch(`/api/operational-units/${unit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName.trim() }),
      })

      if (res.ok) {
        setUnit({ ...unit, name: tempName.trim() })
        if (summary?.unit) {
          setSummary({ ...summary, unit: { ...summary.unit, name: tempName.trim() } })
        }
        setEditNameDialog(false)
        alert("تم تحديث اسم الوحدة بنجاح")
      } else {
        alert("فشل تحديث اسم الوحدة")
      }
    } catch (err) {
      console.error("Error:", err)
      alert("حدث خطأ أثناء التحديث")
    } finally {
      setSavingName(false)
    }
  }

  const handleAddResident = async () => {
    if (!newResident.name.trim()) {
      alert("الرجاء إدخال اسم الساكن")
      return
    }

    setSavingResident(true)
    try {
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newResident,
          unitId,
        }),
      })

      if (res.ok) {
        const resident = await res.json()
        setResidents([...residents, resident])
        setNewResident({ name: "", email: "", phone: "", address: "" })
        setAddResidentDialog(false)
        alert("تم إضافة الساكن بنجاح")
        fetchUnitData() // Refresh data
      } else {
        const errorData = await res.json()
        alert(errorData.error || "فشل إضافة الساكن")
      }
    } catch (err) {
      console.error("Error:", err)
      alert("حدث خطأ أثناء إضافة الساكن")
    } finally {
      setSavingResident(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Unit not found"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">{unit.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{unit.project.name}</span>
            <span>•</span>
            <span className="text-sm">{unit.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditNameDialog(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              تعديل اسم الوحدة
            </Button>
          )}
          <Badge variant={unit.isActive ? "default" : "secondary"}>
            {unit.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Monthly Billing Card */}
      {(isAdmin || isAccountant) && (
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Calendar className="h-5 w-5" />
                الفوترة الشهرية
              </div>
              <Button
                size="sm"
                onClick={() => setEditBillingDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                تعديل
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-sm text-zinc-400 mb-2 block">المطالبة الشهرية</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <span className="text-2xl font-bold text-emerald-400">
                    {(unit.monthlyManagementFee || 0).toLocaleString("ar-EG")} EGP
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-zinc-400 mb-2 block">يوم التحصيل الشهري</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <span className="text-2xl font-bold text-blue-400">
                    اليوم {unit.monthlyBillingDay || 1}
                  </span>
                </div>
              </div>
            </div>
            {(!unit.monthlyManagementFee || unit.monthlyManagementFee === 0) && (
              <Alert className="mt-4 bg-yellow-500/10 border-yellow-500/20">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-500">
                  لم يتم تحديد رسوم شهرية لهذه الوحدة. لن يتم إنشاء فواتير تلقائية.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                السكان
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.residents.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                التذاكر المفتوحة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {summary.tickets.new + summary.tickets.inProgress}
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setActiveTab("expenses")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setActiveTab("expenses")
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="عرض المصروفات المعلقة"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                المصروفات المعلقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {summary.expenseNotes.pending}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي المصروفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${summary.expenseNotes.totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="residents">السكان</TabsTrigger>
          <TabsTrigger value="tickets">التذاكر</TabsTrigger>
          <TabsTrigger value="technician">أعمال الفنيين</TabsTrigger>
          <TabsTrigger value="expenses">المصروفات</TabsTrigger>
          {(isAccountant || isAdmin) && (
            <>
              <TabsTrigger value="invoices">الفواتير</TabsTrigger>
              <TabsTrigger value="payments">المدفوعات</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Operations Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>ملخص العمليات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">إجمالي السكان</span>
                    <span className="text-2xl font-bold">{summary.residents.total}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">التذاكر</span>
                    <span className="text-2xl font-bold">{summary.tickets.total}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">سجلات أعمال الفنيين</span>
                    <span className="text-2xl font-bold">{summary.technicianWork.total}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>الملخص المالي</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">إجمالي المصروفات</span>
                    <span className="text-2xl font-bold text-yellow-600">
                      ${summary.expenseNotes.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">الفواتير</span>
                    <span className="text-2xl font-bold">{summary.invoices.total}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">المصروفات المعلقة</span>
                    <span className="text-2xl font-bold text-red-600">
                      {summary.expenseNotes.pending}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Residents Tab */}
        <TabsContent value="residents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">السكان</h3>
            {isPM && (
              <Button onClick={() => setAddResidentDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700" size="sm">
                <Plus className="h-4 w-4" />
                إضافة ساكن
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {residents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا يوجد سكان في هذه الوحدة</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>البريد الإلكتروني</TableHead>
                        <TableHead>رقم الهاتف</TableHead>
                        <TableHead>العنوان</TableHead>
                        {isPM && <TableHead>الإجراءات</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {residents.map((resident) => (
                        <TableRow key={resident.id}>
                          <TableCell className="font-medium">{resident.name}</TableCell>
                          <TableCell>{resident.email || "-"}</TableCell>
                          <TableCell>{resident.phone || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{resident.address || "-"}</TableCell>
                          {isPM && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/residents/${resident.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">التذاكر</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/tickets/new?unitId=${unitId}`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                إضافة تذكرة
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {tickets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد تذاكر في هذه الوحدة</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>العنوان</TableHead>
                        <TableHead>الساكن</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الأولوية</TableHead>
                        <TableHead>مُسند إلى</TableHead>
                        <TableHead>تاريخ الإنشاء</TableHead>
                        {isPM && <TableHead>الإجراءات</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.title}</TableCell>
                          <TableCell>{ticket.resident.name}</TableCell>
                          <TableCell>
                            <Badge variant={ticket.status === "done" ? "default" : "secondary"}>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ticket.priority === "high" ? "destructive" : "outline"}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{ticket.assignedTo?.name || "-"}</TableCell>
                          <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                          {isPM && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tickets/${ticket.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technician Work Tab */}
        <TabsContent value="technician" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">أعمال الفنيين</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/technician-work?unitId=${unitId}`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                تسجيل عمل
              </Button>
            )}
          </div>

          {/* Technician Summary Table */}
          {techWork.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ملخص الفنيين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>الفني</TableHead>
                        <TableHead className="text-right">إجمالي المستحقات</TableHead>
                        <TableHead className="text-right">المدفوع</TableHead>
                        <TableHead className="text-right">المعلق</TableHead>
                        <TableHead className="text-right">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(
                        new Map(
                          techWork.map((work) => [
                            work.technician.name,
                            techWork.filter((w) => w.technician.name === work.technician.name),
                          ])
                        ).entries()
                      ).map(([techName, techWorks]: [string, TechWork[]]) => {
                        const earned = techWorks.reduce((sum, w) => sum + w.amount, 0)
                        const paid = techWorks
                          .filter((w) => w.paymentStatus === "paid")
                          .reduce((sum, w) => sum + w.amount, 0)
                        const pending = earned - paid
                        return (
                          <TableRow key={techName}>
                            <TableCell className="font-medium">{techName}</TableCell>
                            <TableCell className="text-right font-semibold">${earned.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-600">${paid.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-semibold ${pending > 0 ? "text-red-600" : "text-green-600"}`}>
                              ${pending.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {pending > 0 && (
                                <Button
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/payments?unit=${unitId}&amount=${pending.toFixed(2)}`
                                    )
                                  }
                                  size="sm"
                                  className="text-xs"
                                  variant="outline"
                                >
                                  دفع ${pending.toFixed(2)}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Work Records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سجلات الأعمال ({techWork.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {techWork.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد أعمال فنيين مسجلة</p>
              ) : (
                <div className="space-y-3">
                  {techWork.map((work) => (
                    <div key={work.id} className="border p-4 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{work.description}</p>
                          <p className="text-sm text-muted-foreground">{work.technician.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(work.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${work.amount.toFixed(2)}</p>
                          <Badge variant={work.paymentStatus === "paid" ? "default" : "secondary"}>
                            {work.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">المصروفات</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/accounting-notes/new?unitId=${unitId}&type=expense`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                إضافة مصروف
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد مصروفات مسجلة</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الوصف</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.description}</TableCell>
                          <TableCell>${expense.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={expense.isClaimed ? "default" : "secondary"}>
                              {expense.isClaimed ? "مطالب بها" : "غير مطالب بها"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        {(isAccountant || isAdmin) && (
          <TabsContent value="invoices" className="space-y-4">
            <h3 className="text-lg font-semibold">الفواتير</h3>
            <Card>
              <CardContent className="pt-6">
                {invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لا توجد فواتير</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>رقم الفاتورة</TableHead>
                          <TableHead>النوع</TableHead>
                          <TableHead>المالك</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>المدفوع</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => {
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                              <TableCell>{invoice.type}</TableCell>
                              <TableCell>{invoice.ownerAssociation?.name || "-"}</TableCell>
                              <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                <Badge variant={(invoice as any).isPaid ? "default" : "secondary"}>
                                  {(invoice as any).isPaid ? "مدفوعة" : "غير مدفوعة"}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(invoice.issuedAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Payments Tab */}
        {(isAccountant || isAdmin) && (
          <TabsContent value="payments" className="space-y-4">
            <h3 className="text-lg font-semibold">المدفوعات</h3>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">سجل المدفوعات</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Navigation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">التنقل السريع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push(`/dashboard/payments?unit=${unitId}`)}
              className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
            >
              عرض مدفوعات الوحدة
            </button>
            <button
              onClick={() => router.push(`/dashboard/invoices?unit=${unitId}`)}
              className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
            >
              عرض فواتير الوحدة
            </button>
            {(isPM || isAdmin) && (
              <button
                onClick={() => router.push(`/dashboard/residents/new?unitId=${unitId}`)}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                إضافة ساكن
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard/technicians")}
              className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
            >
              عرض الفنيين
            </button>
            <button
              onClick={() => router.push("/dashboard/operational-units")}
              className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
            >
              العودة للوحدات
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Billing Dialog */}
      <Dialog open={editBillingDialog} onOpenChange={setEditBillingDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-400">تعديل بيانات الفوترة الشهرية</DialogTitle>
            <DialogDescription className="text-zinc-400">
              قم بتحديث المطالبة الشهرية ويوم التحصيل لهذه الوحدة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                المطالبة الشهرية (EGP)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tempFee}
                onChange={(e) => setTempFee(parseFloat(e.target.value) || 0)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="0.00"
              />
              <p className="text-xs text-zinc-500">
                أدخل 0 لإيقاف الفوترة التلقائية لهذه الوحدة
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                يوم التحصيل الشهري (1-31)
              </Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={tempDay}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  setTempDay(Math.min(31, Math.max(1, val)))
                }}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="1"
              />
              <p className="text-xs text-zinc-500">
                اليوم من الشهر الذي سيتم فيه توليد الفاتورة تلقائيًا
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditBillingDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={savingBilling}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveBilling}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={savingBilling}
            >
              {savingBilling ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  حفظ التغييرات
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Name Dialog */}
      <Dialog open={editNameDialog} onOpenChange={setEditNameDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">تعديل اسم الوحدة</DialogTitle>
            <DialogDescription className="text-zinc-400">
              عدل اسم الوحدة الحالية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm text-zinc-300">اسم الوحدة</Label>
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
              placeholder="اسم الوحدة"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditNameDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={savingName}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveUnitName}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={savingName || !tempName.trim()}
            >
              {savingName ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  حفظ التغييرات
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Resident Dialog */}
      <Dialog open={addResidentDialog} onOpenChange={setAddResidentDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">إضافة ساكن جديد</DialogTitle>
            <DialogDescription className="text-zinc-400">
              أضف ساكن جديد لوحدة {unit?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                الاسم *
              </Label>
              <Input
                value={newResident.name}
                onChange={(e) => setNewResident({ ...newResident, name: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="اسم الساكن"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                البريد الإلكتروني
              </Label>
              <Input
                type="email"
                value={newResident.email}
                onChange={(e) => setNewResident({ ...newResident, email: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="example@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                رقم الهاتف
              </Label>
              <Input
                type="tel"
                value={newResident.phone}
                onChange={(e) => setNewResident({ ...newResident, phone: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="+20 123 456 7890"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">
                العنوان
              </Label>
              <Input
                value={newResident.address}
                onChange={(e) => setNewResident({ ...newResident, address: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="العنوان الكامل"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddResidentDialog(false)
                setNewResident({ name: "", email: "", phone: "", address: "" })
              }}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={savingResident}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAddResident}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={savingResident || !newResident.name.trim()}
            >
              {savingResident ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  إضافة الساكن
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
