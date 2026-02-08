"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Users, Plus, Edit, Phone, Mail, Loader, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Resident {
  id: string
  name: string
  phone: string
  email: string
  address: string
  status: "ACTIVE" | "INACTIVE" | "MOVED_OUT"
  createdAt: string
  updatedAt: string
  unit: {
    id: string
    code: string
    name: string
    project: {
      id: string
      name: string
    }
  }
}

export default function ResidentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterUnit, setFilterUnit] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")

  const isPM = session?.user?.role === "PROJECT_MANAGER"
  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    if (!isPM && !isAdmin) {
      router.replace("/dashboard")
      return
    }

    fetchData()
  }, [status, session])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const residentsRes = await fetch("/api/residents")
      if (residentsRes.ok) {
        const residentsData = await residentsRes.json()
        setResidents(residentsData)
      } else {
        throw new Error("فشل تحميل البيانات")
      }
    } catch (err) {
      console.error("Error:", err)
      setError("فشل تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  // Get unique units
  const uniqueUnits = Array.from(
    new Map(residents.map(r => [r.unit?.id, r.unit])).values()
  ).sort((a, b) => (a?.code || "").localeCompare(b?.code || "", "ar"))

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const normalizedPhoneSearch = normalizedSearch.replace(/[\s-]/g, "")

  const filteredResidents = residents.filter(r => {
    if (filterUnit && r.unit?.id !== filterUnit) return false
    if (!normalizedSearch) return true

    const nameMatch = r.name?.toLowerCase().includes(normalizedSearch)
    const phoneMatch = (r.phone || "").replace(/[\s-]/g, "").includes(normalizedPhoneSearch)

    return nameMatch || phoneMatch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            السكان
          </h1>
          <p className="text-gray-500 mt-1">إدارة سكان الوحدات والعقارات</p>
        </div>
        {(isPM || isAdmin) && (
          <Button onClick={() => router.push("/dashboard/residents/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة ساكن
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium block mb-2">بحث بالاسم أو الهاتف</label>
                <Input
                  placeholder="اكتب الاسم أو رقم الهاتف"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {uniqueUnits.length > 0 && (
                <div className="flex-1">
                  <label className="text-sm font-medium block mb-2">اختر الوحدة</label>
                  <Select value={filterUnit || "default"} onValueChange={(value) => {
                    if (value === "default") setFilterUnit("")
                    else setFilterUnit(value)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="جميع الوحدات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">جميع الوحدات</SelectItem>
                      {uniqueUnits.map(unit => (
                        <SelectItem key={unit?.id} value={unit?.id || ""}>
                          {unit?.code} - {unit?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(filterUnit || searchTerm) && (
                <Button variant="outline" onClick={() => { setFilterUnit(""); setSearchTerm("") }}>
                  مسح
                </Button>
              )}
            </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">إجمالي السكان</p>
            <p className="text-3xl font-bold mt-2">{filteredResidents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 text-sm">الوحدات</p>
            <p className="text-3xl font-bold mt-2">{uniqueUnits.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة السكان</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredResidents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto opacity-50 mb-2" />
              <p>لا توجد بيانات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold text-right whitespace-nowrap">الاسم</TableHead>
                    <TableHead className="font-bold text-right whitespace-nowrap">الهاتف</TableHead>
                    <TableHead className="font-bold text-right whitespace-nowrap">البريد</TableHead>
                    <TableHead className="font-bold text-right whitespace-nowrap">الوحدة</TableHead>
                    <TableHead className="font-bold text-right whitespace-nowrap">المشروع</TableHead>
                    <TableHead className="font-bold text-right whitespace-nowrap">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResidents.map(resident => (
                    <TableRow key={resident.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium whitespace-nowrap">{resident.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span dir="ltr" className="text-sm">{resident.phone || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{resident.email || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {resident.unit?.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {resident.unit?.project?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            resident.status === "ACTIVE" 
                              ? "bg-green-100 text-green-800"
                              : resident.status === "INACTIVE"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {resident.status === "ACTIVE" ? "نشط" 
                           : resident.status === "INACTIVE" ? "غير نشط"
                           : "انتقل"}
                        </Badge>
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
