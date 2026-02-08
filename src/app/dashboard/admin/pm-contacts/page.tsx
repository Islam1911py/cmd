"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, Phone, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ManagerProject {
  projectId: string
  project: {
    id: string
    name: string
  }
}

interface Manager {
  id: string
  name: string
  email: string
  role: string
  canViewAllProjects: boolean
  whatsappPhone: string | null
  assignedProjects: ManagerProject[]
}

interface Project {
  id: string
  name: string
}

export default function PMContactsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [managers, setManagers] = useState<Manager[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null)
  const [projectDialogManager, setProjectDialogManager] = useState<Manager | null>(null)
  const [projectSelection, setProjectSelection] = useState<string[]>([])
  const [savingProjects, setSavingProjects] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading") return

    if (!session || !isAdmin) {
      router.replace("/dashboard")
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [managersRes, projectsRes] = await Promise.all([
          fetch("/api/users?role=PROJECT_MANAGER", { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" })
        ])

        if (!managersRes.ok) {
          throw new Error("تعذر تحميل مديري المشاريع")
        }

        if (!projectsRes.ok) {
          throw new Error("تعذر تحميل قائمة المشاريع")
        }

        const managersData: Manager[] = await managersRes.json()
        const projectsData: Project[] = await projectsRes.json()

        setManagers(Array.isArray(managersData) ? managersData : [])
        setProjects(Array.isArray(projectsData) ? projectsData : [])

        const initialDrafts: Record<string, string> = {}
        if (Array.isArray(managersData)) {
          managersData.forEach((manager) => {
            initialDrafts[manager.id] = manager.whatsappPhone ?? ""
          })
        }
        setPhoneDrafts(initialDrafts)
      } catch (err) {
        console.error("Error loading manager contacts:", err)
        setError(err instanceof Error ? err.message : "تعذر تحميل البيانات")
        toast({
          title: "خطأ",
          description: err instanceof Error ? err.message : "يرجى المحاولة مرة أخرى",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [session, status, isAdmin, router, toast])

  const openProjectDialog = (manager: Manager) => {
    setProjectDialogManager(manager)
    setProjectSelection(manager.assignedProjects?.map((assignment) => assignment.projectId) ?? [])
  }

  const closeProjectDialog = () => {
    setProjectDialogManager(null)
    setProjectSelection([])
  }

  const toggleProjectSelection = (projectId: string, checked: boolean) => {
    setProjectSelection((current) => {
      if (checked) {
        return Array.from(new Set([...current, projectId]))
      }
      return current.filter((id) => id !== projectId)
    })
  }

  const handleSavePhone = async (managerId: string) => {
    const value = phoneDrafts[managerId]?.trim() ?? ""

    try {
      setSavingPhoneId(managerId)
      const response = await fetch(`/api/users/${managerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappPhone: value || null })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error || "تعذر حفظ الرقم"
        throw new Error(message)
      }

      const updatedManager: Manager = await response.json()
      setManagers((current) =>
        current.map((manager) => (manager.id === managerId ? updatedManager : manager))
      )
      setPhoneDrafts((current) => ({
        ...current,
        [managerId]: updatedManager.whatsappPhone ?? ""
      }))

      toast({
        title: "تم الحفظ",
        description: "تم تحديث رقم واتساب المدير بنجاح"
      })
    } catch (err) {
      console.error("Error saving manager phone:", err)
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر حفظ الرقم",
        variant: "destructive"
      })
    } finally {
      setSavingPhoneId(null)
    }
  }

  const handleSaveProjects = async () => {
    if (!projectDialogManager) return

    try {
      setSavingProjects(true)
      const response = await fetch(`/api/users/${projectDialogManager.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: projectSelection })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error || "تعذر تحديث المشاريع"
        throw new Error(message)
      }

      const updatedManager: Manager = await response.json()
      setManagers((current) =>
        current.map((manager) => (manager.id === updatedManager.id ? updatedManager : manager))
      )
      closeProjectDialog()

      toast({
        title: "تم الحفظ",
        description: "تم تحديث المشاريع المسندة للمدير"
      })
    } catch (err) {
      console.error("Error saving manager projects:", err)
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر تحديث المشاريع",
        variant: "destructive"
      })
    } finally {
      setSavingProjects(false)
    }
  }

  const totalAssigned = useMemo(() =>
    managers.reduce((acc, manager) => acc + (manager.assignedProjects?.length ?? 0), 0),
  [managers])

  if (status === "loading" || (session && !isAdmin)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">أرقام مديري المشاريع</h1>
          <p className="text-gray-500">
            سجّل أرقام واتساب المعتمدة لكل مدير مشروع وحدد المشاريع المسندة إليه ليعمل التكامل مع النظم الخارجية بشكل آمن.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                مدراء لديهم رقم مسجل
              </CardTitle>
              <CardDescription>عدد المدراء الذين يملكون رقم واتساب صالح</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {managers.filter((manager) => manager.whatsappPhone && manager.whatsappPhone.length > 0).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                إجمالي مديري المشاريع
              </CardTitle>
              <CardDescription>جميع المستخدمين بدور مدير مشروع</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{managers.length}</div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                إجمالي الإسنادات
              </CardTitle>
              <CardDescription>عدد المشاريع المسندة لجميع المدراء</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">إدارة أرقام مديري المشاريع</CardTitle>
            <CardDescription>
              يمكن للمسؤول فقط تعديل هذه البيانات لضمان حماية صلاحيات الوصول عبر واتساب والنظم المتكاملة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
                {error}
              </div>
            ) : managers.length === 0 ? (
              <p className="text-sm text-gray-500">لا يوجد مديرو مشاريع حتى الآن.</p>
            ) : (
              <div className="space-y-4">
                {managers.map((manager) => {
                  const assignedNames = manager.assignedProjects?.map((assignment) => assignment.project.name) ?? []
                  return (
                    <div
                      key={manager.id}
                      className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 md:items-center border border-gray-100 rounded-lg p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">{manager.name}</p>
                        <p className="text-xs text-gray-500">{manager.email}</p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">رقم واتساب</Label>
                        <Input
                          value={phoneDrafts[manager.id] ?? ""}
                          onChange={(event) =>
                            setPhoneDrafts((current) => ({
                              ...current,
                              [manager.id]: event.target.value
                            }))
                          }
                          placeholder="أدخل الرقم بصيغة دولية"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">المشاريع المسندة</Label>
                        {assignedNames.length === 0 ? (
                          <p className="text-xs text-gray-400">لم يتم تحديد مشاريع بعد</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {assignedNames.map((name) => (
                              <Badge key={name} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Dialog open={projectDialogManager?.id === manager.id} onOpenChange={(open) => (open ? openProjectDialog(manager) : closeProjectDialog())}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              إدارة المشاريع
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>المشاريع المسندة</DialogTitle>
                              <DialogDescription>
                                اختر المشاريع التي يمكن لهذا المدير إدارتها.
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-72 pr-4">
                              <div className="space-y-2">
                                {projects.map((project) => {
                                  const checked = projectSelection.includes(project.id)
                                  return (
                                    <label
                                      key={project.id}
                                      className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(value) =>
                                            toggleProjectSelection(project.id, Boolean(value))
                                          }
                                        />
                                        <span>{project.name}</span>
                                      </div>
                                      {checked && (
                                        <Badge variant="outline" className="text-xs">
                                          مختار
                                        </Badge>
                                      )}
                                    </label>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                            <DialogFooter>
                              <Button variant="outline" onClick={closeProjectDialog}>
                                إلغاء
                              </Button>
                              <Button onClick={handleSaveProjects} disabled={savingProjects}>
                                {savingProjects && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                حفظ المشاريع
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="flex flex-col gap-2 md:items-end">
                        <Button
                          onClick={() => void handleSavePhone(manager.id)}
                          disabled={savingPhoneId === manager.id}
                        >
                          {savingPhoneId === manager.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          حفظ الرقم
                        </Button>
                        <p className="text-[11px] text-gray-400">
                          آخر تحديث تلقائي: {manager.whatsappPhone ? "سيتم استخدام الرقم بعد الحفظ" : "لم يتم تسجيل رقم"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
