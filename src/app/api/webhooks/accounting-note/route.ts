import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readSignedJson } from "@/lib/webhook-signature"
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

// POST /api/webhooks/accounting-note - Create accounting note from WhatsApp (n8n webhook)
// This endpoint is for Project Managers sending accounting notes via WhatsApp
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET
    const { body } = await readSignedJson(req, webhookSecret)

    const pmPhone = body.pmPhone || body.senderPhone || body.from
    const unitCode = body.unitCode || body.unit
    const amount = body.amount
    const reason = body.reason || body.description
    const projectId = body.projectId
    const notes = body.notes

    // Validate required fields
    if (!pmPhone || !unitCode || amount === undefined || amount === null || !reason || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: pmPhone, unitCode, amount, reason, projectId" },
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

    const phoneVariants = buildPhoneVariants(pmPhone)
    const pm = await db.user.findFirst({
      where: {
        role: "PROJECT_MANAGER",
        OR: [
          { whatsappPhone: { in: phoneVariants } },
          { email: pmPhone }
        ]
      },
      include: {
        assignedProjects: {
          where: {
            projectId: projectId
          }
        }
      }
    })

    if (!pm) {
      return NextResponse.json(
        { error: "Project Manager not found for the given contact" },
        { status: 404 }
      )
    }

    if (
      pm.role !== "PROJECT_MANAGER" ||
      (!pm.canViewAllProjects &&
        !pm.assignedProjects.some((ap) => ap.projectId === projectId))
    ) {
      return NextResponse.json(
        { error: "Project Manager is not assigned to this project" },
        { status: 403 }
      )
    }

    // Find operational unit
    const unit = await db.operationalUnit.findFirst({
      where: {
        code: unitCode,
        projectId: projectId
      },
      include: {
        project: true
      }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Operational unit not found for the given code and project" },
        { status: 404 }
      )
    }

    const description = [
      reason,
      notes ? `ملاحظات إضافية:\n${notes}` : null
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim()

    const accountingNote = await db.accountingNote.create({
      data: {
        projectId: unit.projectId,
        unitId: unit.id,
        createdByUserId: pm.id,
        description,
        amount: parsedAmount,
        status: "PENDING"
      },
      include: {
        unit: {
          include: {
            project: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const whatsappMessage = buildWhatsappMessage({
      projectName: accountingNote.unit.project.name,
      unitCode: accountingNote.unit.code,
      unitName: accountingNote.unit.name,
      amount: accountingNote.amount,
      description: accountingNote.description,
      createdBy: accountingNote.createdByUser.name,
      noteId: accountingNote.id,
      createdAt: accountingNote.createdAt
    })

    return NextResponse.json(
      {
        success: true,
        noteId: accountingNote.id,
        message: "Accounting note created successfully",
        accountingNote,
        whatsappMessage
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SIGNATURE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error processing accounting note webhook:", error)

    return NextResponse.json(
      { error: "Failed to create accounting note" },
      { status: 500 }
    )
  }
}
