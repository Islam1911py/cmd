import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

// POST /api/accounting-notes/[id]/convert-to-expense
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Accountant and Admin can convert
    if (session.user.role !== "ACCOUNTANT" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { pmAdvanceId } = body

    if (!pmAdvanceId) {
      return NextResponse.json(
        { error: "PM Advance ID is required" },
        { status: 400 }
      )
    }

    // Get the accounting note
    const note = await (prisma as any).accountingNote.findUnique({
      where: { id },
      include: { unit: true, project: true }
    })

    if (!note) {
      return NextResponse.json(
        { error: "Accounting note not found" },
        { status: 404 }
      )
    }

    if (note.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending notes can be converted" },
        { status: 400 }
      )
    }

    // Verify PM Advance exists and belongs to the project
    const pmAdvance = await prisma.pMAdvance.findUnique({
      where: { id: pmAdvanceId }
    })

    if (!pmAdvance) {
      return NextResponse.json(
        { error: "PM Advance not found" },
        { status: 404 }
      )
    }

    if (pmAdvance.projectId !== note.projectId) {
      return NextResponse.json(
        { error: "PM Advance does not belong to this project" },
        { status: 400 }
      )
    }

    // Create UnitExpense from the note
    const expense = await (prisma.unitExpense.create as any)({
      data: {
        unitId: note.unitId,
        pmAdvanceId: pmAdvanceId,
        date: new Date(),
        description: note.description,
        amount: note.amount,
        sourceType: "OTHER",
        recordedByUserId: session.user.id,
        fromAccountingNoteId: id
      }
    })

    // Update the accounting note status
    await (prisma as any).accountingNote.update({
      where: { id },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedToExpenseId: expense.id
      }
    })

    // Update PM Advance remaining amount
    const newRemaining = pmAdvance.remainingAmount - note.amount
    await prisma.pMAdvance.update({
      where: { id: pmAdvanceId },
      data: { remainingAmount: Math.max(0, newRemaining) }
    })

    return NextResponse.json(
      {
        note: { ...note, status: "CONVERTED", convertedAt: new Date() },
        expense
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error converting note to expense:", error)
    return NextResponse.json(
      { error: "Failed to convert note to expense" },
      { status: 500 }
    )
  }
}
