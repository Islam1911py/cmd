import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Accountant and Admin can record (convert) notes
    if (session.user.role !== "ACCOUNTANT" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const noteId = params.id
    const body = await req.json()
    const { sourceType, pmAdvanceId } = body

    if (!sourceType) {
      return NextResponse.json(
        { error: "Missing required field: sourceType" },
        { status: 400 }
      )
    }

    // Fetch accounting note
    const note = await prisma.accountingNote.findUnique({
      where: { id: noteId },
      include: {
        unit: {
          include: { project: true }
        },
        project: true
      }
    })

    if (!note) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    if (note.status !== "PENDING") {
      return NextResponse.json(
        { error: "This note has already been recorded" },
        { status: 400 }
      )
    }

    // Validate PM Advance if sourceType is PM_ADVANCE
    if (sourceType === "PM_ADVANCE" && pmAdvanceId) {
      const pmAdvance = await prisma.pMAdvance.findUnique({
        where: { id: pmAdvanceId }
      })

      if (!pmAdvance) {
        return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
      }

      if (pmAdvance.remainingAmount < note.amount) {
        return NextResponse.json(
          { error: "Insufficient PM Advance balance" },
          { status: 400 }
        )
      }
    }

    // Get or create owner association for this unit
    let ownerAssociation = await prisma.ownerAssociation.findFirst({
      where: { unitId: note.unitId }
    })

    if (!ownerAssociation) {
      ownerAssociation = await prisma.ownerAssociation.create({
        data: {
          name: `Owner - ${note.unit.name}`,
          unitId: note.unitId,
          phone: "",
          email: ""
        }
      })
    }

    // Create a CLAIM invoice for this note
    const invoiceNumber = `CLM-${Date.now()}-${note.unit.code}`
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        type: "CLAIM",
        unitId: note.unitId,
        ownerAssociationId: ownerAssociation.id,
        amount: note.amount,
        remainingBalance: note.amount
      }
    })

    // Create operational expense record
    const expense = await prisma.operationalExpense.create({
      data: {
        description: note.description,
        amount: note.amount,
        sourceType,
        unitId: note.unitId,
        claimInvoiceId: invoice.id,
        recordedByUserId: session.user.id,
        pmAdvanceId: sourceType === "PM_ADVANCE" ? pmAdvanceId : null
      }
    })

    // Deduct from PM Advance if applicable
    if (sourceType === "PM_ADVANCE" && pmAdvanceId) {
      await prisma.pMAdvance.update({
        where: { id: pmAdvanceId },
        data: {
          remainingAmount: {
            decrement: note.amount
          }
        }
      })
    }

    // Update accounting note status
    await prisma.accountingNote.update({
      where: { id: noteId },
      data: {
        status: "CONVERTED",
        convertedToExpenseId: expense.id,
        convertedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "Accounting note recorded successfully. Invoice created.",
      invoice,
      expense,
      invoiceNumber: invoice.invoiceNumber
    })
  } catch (error) {
    console.error("Error recording accounting note:", error)
    return NextResponse.json(
      { error: "Failed to record accounting note", details: String(error) },
      { status: 500 }
    )
  }
}
