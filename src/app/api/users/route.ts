import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and ACCOUNTANT can view users
    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")

    const where: any = {}
    if (role) {
      where.role = role // Filter by role if provided
    }

    const users = await db.user.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canViewAllProjects: true,
        whatsappPhone: true,
        assignedProjects: {
          select: {
            projectId: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users", details: String(error) },
      { status: 500 }
    )
  }
}
