"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { AlertCircle, Plus, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface OperationalUnit {
  id: string
  name: string
  code: string
  type: string
  projectId?: string
}

interface Project {
  id: string
  name: string
}

interface PMAdvance {
  id: string
  user: { id: string; name: string; email: string }
  project: { id: string; name: string }
  amount: number
  remainingAmount: number
}

interface OperationalExpense {
  id: string
  unitId: string
  description: string
  amount: number
  sourceType: "OFFICE_FUND" | "PM_ADVANCE"
  pmAdvanceId?: string
  recordedByUser: { id: string; name: string; email: string }
  recordedAt: string
  unit: OperationalUnit
  pmAdvance?: PMAdvance
}

export default function OperationalExpensesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [sourceType, setSourceType] = useState<"OFFICE_FUND" | "PM_ADVANCE">("OFFICE_FUND")

  const [projects, setProjects] = useState<Project[]>([])
  const [units, setUnits] = useState<OperationalUnit[]>([])
  const [pmAdvances, setPmAdvances] = useState<PMAdvance[]>([])
  const [expenses, setExpenses] = useState<OperationalExpense[]>([])

  const [formData, setFormData] = useState({
    projectId: "",
    unitId: "",
    description: "",
    amount: "",
    pmAdvanceId: ""
  })

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true)

        // Fetch projects
        const projectsRes = await fetch("/api/projects")
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json()
          setProjects(Array.isArray(projectsData) ? projectsData : [])
        }

        // Fetch operational units
        const unitsRes = await fetch("/api/operational-units")
        if (unitsRes.ok) {
          const unitsData = await unitsRes.json()
          setUnits(Array.isArray(unitsData) ? unitsData : [])
        }

        // Fetch PM Advances
        const advancesRes = await fetch("/api/pm-advances")
        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }

        // Fetch operational expenses
        const expensesRes = await fetch("/api/operational-expenses")
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          setExpenses(Array.isArray(expensesData) ? expensesData : [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load data. Please refresh the page.",
          variant: "destructive"
        })
      } finally {
        setIsFetching(false)
      }
    }

    fetchData()
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.projectId || !formData.unitId || !formData.description || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }
    // Additional validation: ensure unitId exists in the units array
    const selectedUnit = units.find(u => u.id === formData.unitId)
    if (!selectedUnit) {
      toast({
        title: "Error",
        description: "Invalid unit selection. Please select a valid unit.",
        variant: "destructive"
      })
      return
    }
    if (sourceType === "PM_ADVANCE" && !formData.pmAdvanceId) {
      toast({
        title: "Validation Error",
        description: "Please select an advance when using PM_ADVANCE source.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)

      const payload = {
        unitId: formData.unitId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        sourceType,
        ...(sourceType === "PM_ADVANCE" && { pmAdvanceId: formData.pmAdvanceId })
      }

      const response = await fetch("/api/operational-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create expense")
      }

      const result = await response.json()

      // Update expenses list
      const expensesRes = await fetch("/api/operational-expenses")
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json()
        setExpenses(Array.isArray(expensesData) ? expensesData : [])
      }

      // Refresh PM Advances if using one
      if (sourceType === "PM_ADVANCE") {
        const advancesRes = await fetch("/api/pm-advances")
        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }
      }

      setIsOpen(false)
      setFormData({ projectId: "", unitId: "", description: "", amount: "", pmAdvanceId: "" })
      setSourceType("OFFICE_FUND")

      toast({
        title: "Success",
        description: "Operational expense created successfully!"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create expense",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">نفقات تشغيلية</h1>
          <p className="text-muted-foreground mt-2">إدارة نفقات الوحدات من صندوق المكتب أو العهد</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const handleDialogOpen = async (newOpen: boolean) => {
    if (newOpen && !isOpen) {
      // When opening the dialog, refresh the data
      try {
        const expensesRes = await fetch("/api/operational-expenses")
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          setExpenses(Array.isArray(expensesData) ? expensesData : [])
        }
        
        const advancesRes = await fetch("/api/pm-advances")
        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }
      } catch (error) {
        console.error("Error refreshing data:", error)
      }
    }
    setIsOpen(newOpen)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">نفقات تشغيلية</h1>
          <p className="text-muted-foreground mt-2">إدارة نفقات الوحدات من صندوق المكتب أو العهد</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              نفقة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>نفقة تشغيلية جديدة</DialogTitle>
              <DialogDescription>
                أضف نفقة تشغيلية جديدة من صندوق المكتب أو من عهدة مدير المشروع
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">المشروع *</Label>
                <Select value={formData.projectId} onValueChange={(v) => {
                  setFormData({ ...formData, projectId: v, unitId: "" })
                }}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة *</Label>
                <Select value={formData.unitId} onValueChange={(v) => setFormData({ ...formData, unitId: v })} disabled={!formData.projectId}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="اختر الوحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.projectId && units
                      .filter((unit) => unit.projectId === formData.projectId)
                      .map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">الوصف *</Label>
                <Input
                  id="description"
                  placeholder="مثال: شراء أدوات، دفع فاتورة، إلخ"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <Label htmlFor="sourceType">مصدر النفقة *</Label>
                <Select value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
                  <SelectTrigger id="sourceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE_FUND">من صندوق المكتب</SelectItem>
                    <SelectItem value="PM_ADVANCE">من عهدة مدير المشروع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PM Advance Selection (conditional) */}
              {sourceType === "PM_ADVANCE" && (
                <div className="space-y-2">
                  <Label htmlFor="pmAdvance">عهدة مدير المشروع *</Label>
                  <Select value={formData.pmAdvanceId} onValueChange={(v) => setFormData({ ...formData, pmAdvanceId: v })}>
                    <SelectTrigger id="pmAdvance">
                      <SelectValue placeholder="اختر عهدة" />
                    </SelectTrigger>
                    <SelectContent>
                      {pmAdvances.filter((adv) => adv.remainingAmount > 0).map((advance) => (
                        <SelectItem key={advance.id} value={advance.id}>
                          {advance.user.name} - {advance.project.name} (متبقي: {advance.remainingAmount.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Show remaining balance if PM Advance is selected */}
                  {formData.pmAdvanceId && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                      المتبقي من العهدة:{" "}
                      <span className="font-bold">
                        {pmAdvances
                          .find((adv) => adv.id === formData.pmAdvanceId)
                          ?.remainingAmount.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  حفظ النفقة
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي النفقات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)} جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} نفقة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">من صندوق المكتب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expenses
                .filter((exp) => exp.sourceType === "OFFICE_FUND")
                .reduce((sum, exp) => sum + exp.amount, 0)
                .toFixed(2)}{" "}
              جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenses.filter((exp) => exp.sourceType === "OFFICE_FUND").length} نفقة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">من العهد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expenses
                .filter((exp) => exp.sourceType === "PM_ADVANCE")
                .reduce((sum, exp) => sum + exp.amount, 0)
                .toFixed(2)}{" "}
              جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenses.filter((exp) => exp.sourceType === "PM_ADVANCE").length} نفقة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل النفقات التشغيلية</CardTitle>
          <CardDescription>قائمة بجميع النفقات التشغيلية المسجلة</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>لا توجد نفقات مسجلة حتى الآن</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>المصدر</TableHead>
                    <TableHead>السجل بواسطة</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.unit.name} ({expense.unit.code})
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell className="font-bold">{expense.amount.toFixed(2)} جنيه</TableCell>
                      <TableCell>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            expense.sourceType === "OFFICE_FUND"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {expense.sourceType === "OFFICE_FUND" ? "صندوق المكتب" : "عهدة"}
                        </span>
                      </TableCell>
                      <TableCell>{expense.recordedByUser.name}</TableCell>
                      <TableCell>
                        {new Date(expense.recordedAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
