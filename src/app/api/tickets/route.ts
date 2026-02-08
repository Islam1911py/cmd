import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/tickets - List tickets
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const projectIds = session.user.projectIds as string[]
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const projectId = searchParams.get("projectId")

    // Build where clause
    let where: any = {}

    // Project Managers can only see their assigned projects
    if (role === "PROJECT_MANAGER") {
      where.unit = {
        projectId: { in: projectIds }
      }
    }

    // Filter by status if provided
    if (status) {
      where.status = status
    }

    // Filter by priority if provided
    if (priority) {
      where.priority = priority
    }

    // Filter by project if provided (Admin only)
    if (projectId && role === "ADMIN") {
      where.unit = {
        projectId: projectId
      }
    }

    // Fetch tickets with relations
    const tickets = await db.ticket.findMany({
      where,
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    )
  }
}

// POST /api/tickets - Create ticket (for n8n webhook)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      residentPhone,
      unitCode,
      description,
      projectId
    } = body

    // Validate required fields
    if (!residentPhone || !unitCode || !description || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find unit by code and project
    const unit = await db.operationalUnit.findFirst({
      where: {
        code: unitCode,
        projectId: projectId
      }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
    }

    // Find resident by phone in this unit
    const resident = await db.resident.findFirst({
      where: {
        phone: residentPhone,
        unitId: unit.id
      }
    })

    if (!resident) {
      return NextResponse.json(
        { error: "Resident not found" },
        { status: 404 }
      )
    }

    // Create ticket
    const ticket = await db.ticket.create({
      data: {
        title: description.substring(0, 100),
        description,
        status: "NEW",
        priority: "Normal",
        residentId: resident.id,
        unitId: resident.unitId
      },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error("Error creating ticket:", error)
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    )
  }
}
