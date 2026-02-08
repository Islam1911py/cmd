import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"

function buildWhatsappMessage(options: {
  projectName: string
  unitCode: string
  unitName?: string | null
  amount: number
  description: string
  createdBy: string
  noteId: string
  createdAt: Date
}) {
  const amountText = new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2
  }).format(options.amount)

  const createdAt = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(options.createdAt)

  const unitLabel = options.unitName
    ? `${options.unitCode} - ${options.unitName}`
    : options.unitCode

  return [
    "📌 ملاحظة محاسبية جديدة",
    `رقم الملاحظة: ${options.noteId}`,
    `التاريخ: ${createdAt}`,
    `المشروع: ${options.projectName}`,
    `الوحدة: ${unitLabel}`,
    `القيمة: ${amountText}`,
    "",
    "التفاصيل:",
    options.description,
    "",
    `أُنشئت بواسطة: ${options.createdBy}`
  ]
    .join("\n")
    .trim()
}

// POST /api/webhooks/accounting-notes - من PM لإضافة ملاحظات محاسبية
export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    // Only PROJECT_MANAGER or ADMIN can create accounting notes
    if (
      auth.context.role !== "PROJECT_MANAGER" &&
      auth.context.role !== "ADMIN"
    ) {
      await logWebhookEvent(
        auth.context.keyId,
        "ACCOUNTING_NOTE_CREATED",
        "/api/webhooks/accounting-notes",
        "POST",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only PROJECT_MANAGER or ADMIN can create notes",
        ipAddress
      )

      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    // Validate required fields
    const { unitId, description, amount, reason, notes, createdByUserId, pmPhone } = body

    if (!unitId || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        {
          error: "Missing required fields: unitId, description, amount"
        },
        { status: 400 }
      )
    }

    const parsedAmount = Number(amount)
    if (Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      )
    }

    // Find unit
    const unit = await db.operationalUnit.findUnique({
      where: { id: unitId },
      include: {
        project: true
      }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
    }

    // If the API key is scoped to a project, enforce it matches the unit
    if (auth.context.projectId && auth.context.projectId !== unit.projectId) {
      return NextResponse.json(
        { error: "This API key is not allowed to access this project" },
        { status: 403 }
      )
    }

    // Locate the user who will be marked as the creator
    const normalizedDescription = [
      description,
      reason ? `سبب إضافي:\n${reason}` : null,
      notes ? `ملاحظات إضافية:\n${notes}` : null
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim()

    const phoneVariants = pmPhone ? buildPhoneVariants(pmPhone) : []

    const orConditions: any[] = []
    if (createdByUserId) {
      orConditions.push({ id: createdByUserId })
    }
    if (pmPhone && phoneVariants.length > 0) {
      orConditions.push({
        AND: [
          { role: "PROJECT_MANAGER" },
          {
            OR: [
              { whatsappPhone: { in: phoneVariants } },
              { email: { in: phoneVariants } }
            ]
          }
        ]
      })
    }
    if (auth.context.role === "PROJECT_MANAGER") {
      orConditions.push({
        AND: [
          { role: "PROJECT_MANAGER" },
          {
            OR: [
              { canViewAllProjects: true },
              { assignedProjects: { some: { projectId: unit.projectId } } }
            ]
          }
        ]
      })
    }
    if (auth.context.role === "ADMIN") {
      orConditions.push({ role: "ADMIN" })
    }
    if (orConditions.length === 0) {
      orConditions.push({ role: { in: ["ADMIN", "PROJECT_MANAGER"] } })
    }

    const creatorCandidates = await db.user.findMany({
      where: { OR: orConditions },
      include: {
        assignedProjects: true
      },
      orderBy: { createdAt: "asc" }
    })

    const creatorUser = creatorCandidates.find(user =>
      auth.context.role === "PROJECT_MANAGER"
        ? user.role === "PROJECT_MANAGER"
        : true
    ) || creatorCandidates[0]

    if (!creatorUser) {
      return NextResponse.json(
        { error: "No eligible user found to own this note" },
        { status: 403 }
      )
    }

    if (
      creatorUser.role === "PROJECT_MANAGER" &&
      !creatorUser.canViewAllProjects &&
      !creatorUser.assignedProjects.some(ap => ap.projectId === unit.projectId)
    ) {
      return NextResponse.json(
        { error: "Project Manager is not assigned to this project" },
        { status: 403 }
      )
    }

    // Create accounting note
    const accountingNote = await db.accountingNote.create({
      data: {
        projectId: unit.projectId,
        unitId: unit.id,
        createdByUserId: creatorUser.id,
        description: normalizedDescription,
        amount: parsedAmount,
        status: "PENDING"
      },
      include: {
        unit: {
          include: { project: true }
        },
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const response = {
      success: true,
      noteId: accountingNote.id,
      unit: {
        id: accountingNote.unit.id,
        code: accountingNote.unit.code,
        name: accountingNote.unit.name,
        project: accountingNote.unit.project.name
      },
      description: accountingNote.description,
      amount: accountingNote.amount,
      reason,
      notes,
      status: accountingNote.status,
      createdBy: accountingNote.createdByUser.name,
        createdAt: accountingNote.createdAt,
        message: "Accounting note created successfully",
        whatsappMessage: buildWhatsappMessage({
          projectName: accountingNote.unit.project.name,
          unitCode: accountingNote.unit.code,
          unitName: accountingNote.unit.name,
          amount: accountingNote.amount,
          description: accountingNote.description,
          createdBy: accountingNote.createdByUser.name,
          noteId: accountingNote.id,
          createdAt: accountingNote.createdAt
        })
    }

    await logWebhookEvent(
      auth.context.keyId,
      "ACCOUNTING_NOTE_CREATED",
      "/api/webhooks/accounting-notes",
      "POST",
      201,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("Error creating accounting note:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "ACCOUNTING_NOTE_CREATED",
        "/api/webhooks/accounting-notes",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { error: "Failed to create accounting note" },
      { status: 500 }
    )
  }
}
